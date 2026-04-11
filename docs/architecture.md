# Architecture

## Overview

Claude Usage Hub is a TypeScript monorepo with five packages. In local mode all packages run in one process. In team mode the server runs centrally in Docker and the collector runs on each developer's machine independently.

```
packages/
  shared/      # Types, schemas, pricing constants — no runtime deps
  collector/   # Reads Claude Code JSONL logs, uploads to server
  server/      # Hono API + SQLite — serves dashboard and accepts ingest
  dashboard/   # React SPA — served as static files by the server
  cli/         # Entry point that wires collector + server together (local mode)
```

## Package Dependency Graph

```
cli ──────────────┬──▶ collector
                  └──▶ server
                            │
collector ────────────────▶ shared
server ───────────────────▶ shared
dashboard ────────────────▶ shared (types only, via Vite build)
```

## Data Flow

### Local mode

```
~/.claude/projects/**/*.jsonl
          │
          │  JSONL streaming parser
          ▼
    [ Collector ]
          │  byte-offset cursor (incremental reads)
          │  deduplication (keeps final token count per API response)
          │  SHA-256 project alias hashing
          │  subagent token rollup
          │  cost calculation
          ▼
    [ SQLite DB ]  ←──────────────────────────────────────────────
    ~/.claude-usage-hub/usage.db                                  │
          │                                                        │
          ▼                                                        │
    [ Hono Server :8080 ]  ──────▶  [ React Dashboard ]  ────────┘
```

### Team mode

```
Machine A                       Machine B
~/.claude/projects/             ~/.claude/projects/
        │                               │
   [ Collector ]                   [ Collector ]
   API key A                       API key B
   outbox + retry                  outbox + retry
        │                               │
        └──────────┬────────────────────┘
                   │  POST /api/v1/ingest
                   │  X-API-Key: chub_xxx
                   ▼
          [ Hono Server :8080 ]
          [ SQLite /data/usage.db ]
                   │
                   ▼
          [ React Dashboard ]
          JWT-authenticated
          role-scoped queries
```

## Collector

The collector is a standalone Node.js process that:

1. Scans `~/.claude/projects/**/*.jsonl` for Claude Code session files
2. Reads new bytes from each file using stored byte-offset cursors (never re-reads)
3. Parses JSONL entries, deduplicates streaming tokens (keeps the final count per API response)
4. Rolls up subagent token usage into the parent session
5. Hashes project directory paths into opaque aliases via SHA-256 + a per-installation salt
6. Calculates cost using Anthropic's published pricing
7. Uploads the payload to the server, or queues it locally for retry if the server is unreachable

In local mode the collector runs in-process with the server (via the CLI package). In team mode it runs as a background daemon on each developer's machine.

**Cursor tracking:** Each `.jsonl` file has a byte offset stored in `~/.claude-usage-hub/cursors.json`. On each run only new bytes are read. This makes collection O(new data) regardless of total log size.

**Deduplication:** Claude Code streams token counts as events arrive. The collector sees multiple entries for the same API request ID with increasing token counts. Only the final entry (highest input+output total) is kept per request ID before uploading.

**Privacy:** Project directory paths are never stored. They are hashed with SHA-256 + a random per-installation salt into a short alias (`abc123`). The mapping is stored locally only (`aliases.json`) and never sent to the server.

## Server

Built with [Hono](https://hono.dev/) on Node.js. SQLite via `better-sqlite3` with WAL mode for concurrent reads.

### Route structure

```
/api/v1/health              — always public
/api/v1/config              — always public (Google client ID, mode)
/api/v1/ingest              — API key auth (team mode)
/api/v1/me                  — API key auth (team mode) — collector identity
/api/v1/dashboard/*         — JWT auth (team mode) / open (local mode)
/api/v1/sessions/*          — JWT auth (team mode) / open (local mode)
/api/v1/projects/*          — JWT auth (team mode) / open (local mode)
/api/v1/profile/*           — JWT auth (team mode)
/api/v1/admin/*             — JWT auth + owner role (team mode)
/auth/login                 — public
/auth/google/verify         — public
/auth/logout                — public
/auth/me                    — JWT auth
/auth/invite/accept         — public (token-gated)
/download/collector.js      — always public
/install.sh                 — always public
/install.ps1                — always public
```

### Query scoping

All data queries accept an optional `developerId` parameter. In team mode:
- Developers: queries are scoped to `WHERE developer_id = ?` (their own data only)
- Owners / Primary Owners: no filter applied (all data)
- Local mode: no filter applied

The scope is resolved server-side from the authenticated JWT — clients cannot override it.

### Time bucketing

Timeseries queries bucket data by time range:

| Range | Bucket size |
|-------|-------------|
| 5h    | 15 minutes  |
| 24h   | 1 hour      |
| 7d    | 6 hours     |
| 30d   | 1 day       |
| all   | 1 day       |

## Database Schema

### Core table

```sql
usage_entries (
  id                     TEXT PRIMARY KEY,
  session_id             TEXT NOT NULL,
  message_id             TEXT NOT NULL,
  request_id             TEXT NOT NULL,
  timestamp              TEXT NOT NULL,
  model                  TEXT NOT NULL,
  input_tokens           INTEGER,
  output_tokens          INTEGER,
  cache_creation_tokens  INTEGER,
  cache_read_tokens      INTEGER,
  cost_usd               REAL,
  developer_id           TEXT,
  project_alias          TEXT,
  service_tier           TEXT,
  api_key_id             TEXT,          -- which machine submitted this entry
  UNIQUE(message_id, request_id)
)
```

### Auth tables (team mode only)

```sql
users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE,
  display_name  TEXT,
  role          TEXT,    -- primary_owner | owner | developer
  developer_id  TEXT UNIQUE,
  password_hash TEXT,    -- scrypt, empty for Google-only users
  google_id     TEXT,
  created_at    TEXT,
  updated_at    TEXT
)

api_keys (
  id           TEXT PRIMARY KEY,
  user_id      TEXT REFERENCES users(id),
  key_prefix   TEXT,    -- first 12 chars, shown in UI
  key_hash     TEXT UNIQUE,  -- SHA-256 of full key
  label        TEXT,
  developer_id TEXT,
  created_at   TEXT,
  revoked_at   TEXT,
  last_used_at TEXT
)

invitations (
  id           TEXT PRIMARY KEY,
  email        TEXT,
  token_hash   TEXT UNIQUE,
  invited_by   TEXT REFERENCES users(id),
  role         TEXT,
  expires_at   TEXT,
  accepted_at  TEXT,
  created_at   TEXT
)
```

## Authentication Flow (Team Mode)

### Google OAuth (normal login)

```
Browser                    Server                      Google
   │                          │                           │
   │── click Sign In ────────▶│                           │
   │◀─ GSI button rendered ───│                           │
   │── user clicks button ───▶│ (GSI iframe handles this) │
   │                          │──── verify ID token ─────▶│
   │                          │◀─── token claims ─────────│
   │                          │  domain check ✓           │
   │                          │  find/create user         │
   │◀─── JWT (24h) ───────────│                           │
```

### Invite flow

```
Owner                      Server                     New Member
  │                           │                           │
  │── POST /admin/invitations▶│                           │
  │◀─ invite URL (7-day) ─────│                           │
  │── share URL via Slack ───────────────────────────────▶│
  │                           │◀── Google sign-in ────────│
  │                           │    verify invite token    │
  │                           │    create user + API key  │
  │                           │──── JWT + API key ────────▶│
```

### Collector authentication

```
Collector                  Server
    │                         │
    │── POST /api/v1/ingest ─▶│
    │   X-API-Key: chub_xxx   │
    │                         │  SHA-256(key) → lookup api_keys
    │                         │  resolve developer_id from key
    │                         │  verify payload.developerId matches
    │◀─ { inserted: N } ──────│
```

## Dashboard

Single-page React application built with Vite. Served as static files by the Hono server — no separate frontend server in production.

- **State:** TanStack Query for server state, auto-refresh every 60 seconds
- **Charts:** Recharts (direct, no wrapper libraries)
- **Styling:** Tailwind CSS, dark/light mode via `class` strategy
- **Auth:** JWT stored in `localStorage`, sent as `Authorization: Bearer` header, cleared on 401

In development, Vite runs on `:5173` and proxies `/api` to the server on `:8080`.
