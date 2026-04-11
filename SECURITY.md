# Security Policy

## Overview

Claude Usage Hub processes Claude Code usage metadata (token counts, timestamps, model names, session IDs). It does **not** read or store conversation content, prompts, responses, file paths, or code.

However, the data it does store reveals work patterns:

- **When you work** — session timestamps
- **How much you use** — token consumption rates
- **Which models** — Opus, Sonnet, Haiku usage patterns
- **Project count** — number of distinct projects (names are hashed)
- **Estimated cost** — based on API pricing

This data should be treated as private.

## Local Mode

The server binds to `127.0.0.1` (localhost only) and is not accessible from other devices on your network.

- **No authentication** — anyone with access to your machine can view the dashboard
- **No encryption in transit** — localhost connections don't need TLS
- **File permissions** — the database is set to `0600` (owner read/write only)

### Recommendations

- Do not change the bind address to `0.0.0.0`
- Keep your machine's user account secured
- The database can be deleted at any time: `rm ~/.claude-usage-hub/usage.db`

## Team Mode

### Authentication

- **Google OAuth** — login is restricted to a single configured Google Workspace domain (`ALLOWED_DOMAIN`). Anyone outside that domain is rejected at sign-in.
- **JWT sessions** — HS256 tokens signed with `JWT_SECRET`, expire after 24 hours. Tokens are verified on every authenticated request.
- **API keys** — collector agents authenticate with `chub_`-prefixed keys. Keys are stored as SHA-256 hashes only — the raw key is shown once at creation and never stored.

### Authorization

- **Role-based access** — Developers can only read their own usage data. Owners and Primary Owners see all members' data.
- **Ingest scoping** — the server resolves the developer identity from the authenticated API key, not from the payload. A collector cannot submit data under a different developer's identity.

### Transport

- HTTPS is required. The app does not enforce HTTPS itself — it is the operator's responsibility to terminate TLS in front of port 8080.

### Data storage

- The SQLite database file is set to `0600` permissions.
- No raw API keys, passwords, or Google tokens are stored.
- Admin passwords are hashed with `scrypt` (Node.js built-in, random 16-byte salt).

### Operational recommendations

- Use a strong, randomly generated `JWT_SECRET` (e.g., `openssl rand -hex 32`)
- Change `ADMIN_PASSWORD` immediately after first login and disable password login if all owners use Google OAuth
- Restrict network access to port 8080 — only your developers and the TLS terminator need to reach it
- Set `RETENTION_DAYS` to limit how long usage data is retained
- Run `pnpm audit` periodically to check dependencies for known vulnerabilities

## Data Storage Reference

| What is stored | Where |
|----------------|-------|
| Token counts (input, output, cache) | SQLite |
| Session IDs | SQLite |
| Project aliases (SHA-256 hashes) | SQLite |
| Model names | SQLite |
| Timestamps | SQLite |
| Cost estimates | SQLite |
| API key hashes + prefixes | SQLite |
| Admin password hash (scrypt) | SQLite |
| Collector config (developer ID, salt, server URL) | `~/.claude-usage-hub/config.json` |
| File read cursors | `~/.claude-usage-hub/cursors.json` |
| Project alias mappings | `~/.claude-usage-hub/aliases.json` |

| What is NOT stored | |
|---|---|
| Conversation content (prompts or responses) | |
| File paths or source code | |
| Git branch names or repository URLs | |
| Working directory paths | |
| Raw API keys or passwords | |
| Google ID tokens | |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email the maintainer at rodrigo.rajitha@gmail.com
3. Include a description of the vulnerability and steps to reproduce
4. Allow reasonable time for a fix before public disclosure

## Dependencies

- **better-sqlite3** — SQLite driver
- **hono** — HTTP framework
- **zod** — Schema validation
- **recharts** — Chart library (frontend only)

Dependencies are locked via `pnpm-lock.yaml`. Run `pnpm audit` to check for known vulnerabilities.
