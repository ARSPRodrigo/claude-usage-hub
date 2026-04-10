# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0-alpha] - 2026-04-10

### Added
- **Collector**: Scans `~/.claude/projects/**/*.jsonl` for Claude Code usage data
  - Streaming JSONL parser with byte-offset cursor tracking (incremental reads)
  - Deduplication of streaming entries (keeps final token counts per API response)
  - Privacy-first: project directories hashed into opaque aliases via SHA256
  - Subagent token rollup into parent sessions
  - Cost calculation using official Anthropic API pricing
- **Server**: Hono API with SQLite storage
  - 8 API endpoints: health, stats, token timeseries, cost trend, model mix, sessions, projects, ingest
  - Time-bucketed aggregation queries (15m / 1h / 6h / 1d depending on range)
  - Idempotent ingestion via `INSERT OR IGNORE` on unique message+request IDs
- **Dashboard**: React web UI with neon dark theme
  - Dashboard page: stat cards, stacked area chart, model mix donut, daily cost bars
  - Sessions page: table with human-readable names, model badges, pagination
  - Projects page: table with inline progress bars
  - Dark mode with deep navy-purple palette, cyan/purple/fuchsia accents
  - Light mode with clean slate/white palette
  - Time range selector: 5h, 24h, 7d, 30d, All
  - Auto-refresh every 60 seconds
  - Error boundaries and API error states with retry
- **CLI**: Single `start` command runs collector + server + dashboard
  - Auto-initializes collector config on first run
  - Periodic re-collection every 5 minutes
  - Graceful shutdown on SIGINT/SIGTERM
- **Shared**: TypeScript types, Zod schemas, pricing constants
  - Official Anthropic API pricing (Opus $5/$25, Sonnet $3/$15, Haiku $1/$5)
  - Supports all Claude models including cache token pricing

### Technical
- TypeScript monorepo (pnpm workspaces + Turborepo)
- Direct Recharts for full chart styling control (no wrapper libraries)
- SQLite with WAL mode for concurrent read performance
- Deterministic human-readable name generation from IDs
- ~710 KB dashboard bundle (gzipped: ~202 KB)

## [Unreleased]

### Planned
- Team mode with centralized server and HTTPS collector sync
- Role-based access (developer / admin views)
- Docker Compose deployment
- Email alerts for usage thresholds
- Data retention configuration
- Background daemon installers (launchd / systemd / Task Scheduler)
