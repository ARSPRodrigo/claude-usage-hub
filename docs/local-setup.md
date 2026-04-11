# Local Mode Setup

Local mode runs entirely on your machine — no server, no auth, no configuration required. The collector and dashboard start together with a single command.

## Prerequisites

- Node.js >= 18
- pnpm >= 9

## Installation

```bash
git clone https://github.com/your-org/claude-usage-hub.git
cd claude-usage-hub
pnpm install && pnpm start
```

Open [http://localhost:8080](http://localhost:8080).

## How it works

On first run, the collector is automatically configured to scan `~/.claude/projects/` — the default location where Claude Code writes its usage logs. It runs once immediately, then re-runs every 5 minutes.

The dashboard is served at `localhost:8080` and only accessible from your machine.

## Dashboard pages

| Page | What you see |
|------|-------------|
| Overview | Total tokens, cost, and activity over your chosen time range |
| Sessions | All Claude Code sessions with human-readable names, models used, and cost |
| Projects | Usage grouped by project, with relative cost bars |
| Profile | Collector status and configuration |

## Custom data path

If your Claude Code data is in a non-default location, set `CLAUDE_DATA_PATH` before starting:

```bash
CLAUDE_DATA_PATH=/custom/path pnpm start
```

## Stopping

Press `Ctrl+C`. The collector and server shut down cleanly.
