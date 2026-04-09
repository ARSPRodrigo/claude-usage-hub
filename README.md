# claude-usage-hub

A lightweight, open-source tool for monitoring Claude Code token usage across your team. Designed for engineering managers and team leads who need visibility into how their developers use Claude Code subscriptions.

## Features

- **Team-wide monitoring** - Aggregate token usage across all developers in your organization
- **Privacy-first** - Only token metrics are collected; no conversation content ever leaves developer machines
- **Web dashboard** - React-based UI with real-time charts, dark mode, and role-based access
- **Per-developer views** - Developers see their own usage; admins see the full organization
- **Session & project tracking** - Break down usage by Claude Code session and project (with opaque aliases for privacy)
- **Model breakdown** - Track usage across Opus, Sonnet, and Haiku models
- **Cost estimation** - Dynamic pricing via LiteLLM with tiered pricing support
- **5-hour window tracking** - Monitor usage within Claude's billing windows
- **Configurable alerts** - Email notifications when usage exceeds thresholds
- **Cross-platform** - Collector agent runs on macOS, Linux, and Windows
- **Lightweight** - SQLite database, no heavy infrastructure required

## Architecture

```
Developer Machines (macOS/Linux/Windows)        Central Server (Docker)
┌─────────────────────────┐                    ┌──────────────────────┐
│  Collector Agent         │   HTTPS POST      │  Hono API Server     │
│  (background daemon)     │──────────────────>│  SQLite Database     │
│                          │   every 30 min    │  React Dashboard     │
│  Reads: ~/.claude/       │                    │  Alert Engine        │
│  Sends: token counts     │                    └──────────────────────┘
│  Never sends: content    │
└─────────────────────────┘
```

## Quick Start

### 1. Deploy the server

```bash
git clone https://github.com/ARSPRodrigo/claude-usage-hub.git
cd claude-usage-hub
cp .env.example .env
# Edit .env with your settings
docker compose up -d
```

### 2. Set up the admin account

Open `http://your-server:8080` and follow the setup wizard to create developer accounts and generate API keys.

### 3. Install the collector on each developer machine

```bash
npx @claude-usage-hub/collector init --server https://your-server:8080 --api-key <key>
npx @claude-usage-hub/collector install
```

The collector runs in the background and syncs usage metrics every 30 minutes.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Language | TypeScript |
| Monorepo | pnpm + Turborepo |
| Server | Hono |
| Database | SQLite (better-sqlite3 + Drizzle ORM) |
| Frontend | React + Vite + Tailwind CSS + shadcn/ui + Tremor |
| Auth | JWT + API keys |
| Deployment | Docker Compose |

## Privacy

The collector agent only extracts token usage metadata from Claude Code's local JSONL logs:

- Session ID, timestamp, model name
- Token counts (input, output, cache creation, cache read)
- Service tier

It **never** reads or transmits:

- Conversation content (prompts or responses)
- File paths or code
- Git branches or repository names
- Working directory paths

Project names are replaced with opaque aliases (SHA256 hashes) before leaving the developer's machine.

## Supported Plans

- Claude Pro
- Claude Max (5x, 20x)
- Claude Team (Standard, Premium)
- Claude Enterprise

## Development

```bash
# Prerequisites: Node.js >= 18, pnpm >= 9
pnpm install
pnpm dev
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

[MIT](LICENSE)

## Acknowledgements

Inspired by [ccusage](https://github.com/ryoppippi/ccusage) and [Claude-Code-Usage-Monitor](https://github.com/Maciek-roboblog/Claude-Code-Usage-Monitor).
