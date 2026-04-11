# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.0-beta] - 2026-04-11

### Added — Team Mode
- **Google OAuth authentication** — sign-in restricted to a configured org domain (`ALLOWED_DOMAIN`)
- **Role-based access control** — Primary Owner, Owner, Developer roles; owners see all data, developers see their own
- **Invite system** — owners generate 7-day one-time invite links with role selection (Member / Owner); role shown on each invitation row
- **JWT sessions** — 24-hour HS256 tokens, auto-redirect to login on expiry
- **API key authentication** — `chub_` prefixed keys, SHA-256 hashed at rest, one key per machine
- **Per-machine usage tracking** — `api_key_id` stored per usage entry; no collector changes required (server resolves from auth)
- **`last_used_at` tracking** — API keys record last ingest timestamp; Profile page shows Connected / Not Connected / Revoked sections
- **Developer detail page** — drill into any member's usage with timeseries + model mix charts and a Machines breakdown
- **Per-member data wipe** — owners wipe all usage data for a member from the Overview page
- **Per-machine data wipe** — owners wipe a specific machine's data from the developer detail page
- **Data retention setting** — configurable automatic pruning of old entries
- **Admin bootstrap** — Primary Owner created from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars on first team-mode boot
- **Docker deployment** — multi-stage Dockerfile + Docker Compose with named SQLite volume and optional Cloudflare Tunnel

### Added — Dashboard
- **Split-panel login page** — branded left panel + theme-adaptive right panel; follows system light/dark preference
- **Theme toggle on login page** — Sun/Moon button, persists preference to localStorage; applied before first paint (no flash)
- **Custom Google sign-in button** — styled to match the design system; real GSI iframe overlaid invisibly for reliable OAuth
- **Google GSI error handling** — 10-second timeout + `onerror` with user-visible error message
- **Overview page** — all members shown (owners + developers) with per-member usage table and activity indicators
- **Role badges** — Primary / Owner / Dev shown on member rows and invitation list
- **Profile page machine sections** — Connected machines (Revoke), Not connected (Delete), Revoked history
- **Settings danger zone** — visible to Owner and Primary Owner roles
- **Version display** — reads from `package.json` at runtime, reflects actual deployed version

### Changed
- "Org Overview" renamed to "Overview" throughout
- Settings icon changed from Shield to Settings/cog
- Removed Collector section from Settings page (redundant with Profile page)
- Owners (not just Primary Owner) can delete all usage data
- `composite: true` added to shared and server tsconfigs (fixes collector/CLI reference builds)
- Login page Google button replaced with custom-styled button using invisible GSI iframe overlay

### Fixed
- TokenChart height now matches ModelMixChart (`h-80 flex flex-col`, `height="100%"`)
- `role` column added to `invitations` table via incremental migration for existing databases
- `last_used_at` column added to `api_keys` via incremental migration
- `api_key_id` column added to `usage_entries` via incremental migration
- Resend expired invite preserves the original invitation role
- scp deployment no longer creates nested `dist/` on repeated runs (fix: delete destination before copy)
- Removed hardcoded tunnel token from `docker-compose.yml`

---

## [0.1.2-alpha] - 2026-04-10

### Added
- **CSV export** — download sessions and projects data as CSV files
- **Last collected timestamp** — sidebar footer shows when data was last collected
- **Session drill-down** — click any session to see per-model token breakdown
- **Project drill-down** — click any project to see per-model breakdown
- **Cost breakdown** — Est. Cost card shows stacked bar of input/output/cache costs
- **Welcome card** — first-run experience when no usage data exists
- **70 tests** — pricing, schemas, parser, dedup, privacy, repository, formatters, name generator

### Fixed
- Light mode: card borders more visible, badges softer, chart colors deeper
- Light mode: empty state text contrast improved
- Chart colors adapt to light/dark mode (neon on dark, deeper shades on light)
- Status command ESM require() crash
- Sessions pagination shows total count

### Changed
- Est. Cost breakdown bar shows only the bar (hover for details), no text clutter
- Sidebar nav order: Dashboard > Projects > Sessions

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
