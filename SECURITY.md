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

## Local Mode (Alpha)

In local mode, the server binds to `127.0.0.1` (localhost only). It is **not accessible** from other devices on your network.

- **No authentication** — anyone with access to your machine can view the dashboard
- **No encryption** — data is stored in a plain SQLite file at `~/.claude-usage-hub/usage.db`
- **File permissions** — the database file is set to `0600` (owner read/write only)
- **No HTTPS** — localhost connections don't need TLS

### Recommendations for local mode

- Do not change the bind address to `0.0.0.0` unless you understand the implications
- Keep your machine's user account secured
- The database can be deleted at any time: `rm ~/.claude-usage-hub/usage.db`

## Team Mode (Planned)

Team mode will add:

- JWT authentication with bcrypt password hashing
- API key authentication for collector agents (keys stored as SHA256 hashes)
- HTTPS required for all connections
- Rate limiting per API key and per IP
- CORS restricted to configured origins
- Role-based access control (developer sees own data, admin sees org)
- Configurable data retention with automatic cleanup

## Data Storage

| What is stored | Where |
|---------------|-------|
| Token counts (input, output, cache) | SQLite database |
| Session IDs | SQLite database |
| Project aliases (SHA256 hashes) | SQLite database |
| Model names | SQLite database |
| Timestamps | SQLite database |
| Cost estimates | SQLite database |
| Collector config (developer ID, salt) | `~/.claude-usage-hub/config.json` |
| File read cursors | `~/.claude-usage-hub/cursors.json` |
| Project alias mappings | `~/.claude-usage-hub/aliases.json` |

| What is NOT stored |
|-------------------|
| Conversation content (prompts or responses) |
| File paths or source code |
| Git branch names or repository URLs |
| Working directory paths |
| Claude Code configuration or settings |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email the maintainer at rodrigo.rajitha@gmail.com
3. Include a description of the vulnerability and steps to reproduce
4. Allow reasonable time for a fix before public disclosure

## Dependencies

This project uses well-known, actively maintained open-source packages:

- **better-sqlite3** — SQLite driver (native addon)
- **hono** — HTTP framework
- **recharts** — Chart library (React)
- **zod** — Schema validation

Dependencies are locked via `pnpm-lock.yaml`. Run `pnpm audit` to check for known vulnerabilities.
