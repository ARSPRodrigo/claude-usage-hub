# Claude Usage Hub

A self-hosted, open-source tool for monitoring Claude Code token usage across your entire team. Track token consumption, cost breakdowns, and per-developer visibility — all from a central web dashboard.

> **v0.2.0-beta** — Team mode is live. Local mode is still fully supported with no configuration changes required.

## Features

### Both modes
- **Token analytics** — input, output, cache creation, cache read broken down by model
- **Cost estimation** — based on official Anthropic pricing (Opus 4.6, Sonnet 4.6, Haiku 4.5)
- **Session & project tracking** — opaque aliases protect actual file paths and content
- **Multiple time ranges** — 5h / 24h / 7d / 30d / all-time
- **Dark / light mode** — follows system preference, manually toggleable
- **Privacy-first** — no conversation content is ever read or stored

### Team mode
- **Google OAuth** — restricted to your org domain
- **Role-based access** — Primary Owner / Owner / Developer
- **Invite links** — 7-day one-time invite URLs, role assigned at invite time
- **Per-developer dashboard** — owners see all members, developers see their own data
- **Per-machine tracking** — each API key tracked independently
- **Data management** — owners can wipe per-member or per-machine usage data
- **Data retention** — configurable automatic pruning

## Modes

| | Local | Team |
|---|---|---|
| Who sees data | You | Everyone (scoped by role) |
| Auth | None | Google OAuth (org domain) |
| Collector setup | Auto (same machine) | API key per machine |
| Deployment | `pnpm start` | Docker + env vars |

## Guides

- [Local Mode Setup](docs/local-setup.md) — single developer, runs on your machine
- [Team Mode Setup](docs/team-setup.md) — centralized server, multiple developers
- [Architecture](docs/architecture.md) — how the packages fit together, data flow, auth flows
- [API Reference](docs/api-reference.md) — all endpoints, request/response shapes

## Architecture

```
Local mode
──────────
~/.claude/projects/**/*.jsonl
        │
        ▼
┌───────────────┐    ┌──────────────┐    ┌────────────────┐
│  Collector    │───▶│   SQLite DB  │───▶│ React Dashboard│
│  (same proc)  │    │  (local)     │    │  :8080         │
└───────────────┘    └──────────────┘    └────────────────┘

Team mode
─────────
Developer Machine A         Developer Machine B
~/.claude/projects/         ~/.claude/projects/
        │                           │
   Collector                   Collector
   (API key A)                 (API key B)
        │                           │
        └──────────┬────────────────┘
                   │ HTTPS + X-API-Key
                   ▼
        ┌──────────────────┐
        │  Hono Server     │
        │  SQLite (Docker) │
        │  React Dashboard │
        └──────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Language | TypeScript (monorepo, pnpm workspaces + Turborepo) |
| Server | Hono + @hono/node-server |
| Database | SQLite (better-sqlite3) |
| Auth | JWT (HS256) + Google Identity Services |
| Frontend | React + Vite + Tailwind CSS + Recharts + TanStack Query |
| Deployment | Docker multi-stage build |

## Privacy

The collector only extracts token usage metadata from Claude Code's local JSONL logs — session ID, timestamp, model, token counts, and service tier.

It **never** reads or stores:
- Conversation content (prompts or responses)
- File paths, code, or git information
- Working directory paths

Project directories are hashed into opaque aliases before storage. Session IDs are displayed as human-readable generated names (e.g., `golden-harbor-drift`).

## Security

- Local mode: server binds to `127.0.0.1` only
- Team mode: API keys stored as SHA-256 hashes; JWTs expire after 24h; Google OAuth restricted to your org domain
- SQLite database file is restricted to owner-only permissions (`0600`)

See [SECURITY.md](SECURITY.md) for the full security policy.

## Development

```bash
pnpm install
pnpm build

# Dev mode (two terminals)
cd packages/server && pnpm dev     # Hono on :8080
cd packages/dashboard && pnpm dev  # Vite on :5173 (proxies /api to :8080)

# Tests
pnpm test
```

## Roadmap

- [ ] Cross-platform collector binaries via Node SEA
- [ ] Email / Slack alerts for usage thresholds
- [ ] Mobile-responsive layout
- [ ] Usage budget limits per developer
- [ ] Audit log for admin actions

## License

[MIT](LICENSE)

## Acknowledgements

Inspired by [ccusage](https://github.com/ryoppippi/ccusage) and [Claude-Code-Usage-Monitor](https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor).
