# Team Mode Setup

Team mode runs a central Hub server that all developers in your organization push usage data to. Admins see everyone's data; developers see their own. The Hub supports multiple organizations, workspaces inside each org, and a role hierarchy so different people can manage different scopes.

## Prerequisites

- A server reachable by your developers over HTTPS
- Docker and Docker Compose on that server
- A Google Workspace account (for OAuth)

## 1. Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Under **Authorized JavaScript origins**, add your server's public HTTPS URL:
   ```
   https://your-server.example.com
   ```
5. Copy the **Client ID** — it looks like `xxxx.apps.googleusercontent.com`

> For internal Google Workspace apps you can mark the OAuth consent screen as **Internal** — no review required.

## 2. Deploy the server

```bash
git clone https://github.com/your-org/claude-usage-hub.git
cd claude-usage-hub
cp .env.example .env
```

Fill in `.env`:

```env
MODE=team
JWT_SECRET=<run: openssl rand -hex 32>
ADMIN_EMAIL=you@yourcompany.com
ADMIN_PASSWORD=<strong password>
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
ALLOWED_DOMAIN=yourcompany.com
```

Start the server:

```bash
docker compose up -d
```

The server listens on port 8080. On first boot it creates the bootstrap admin (the **Platform Owner**) from `ADMIN_EMAIL` and `ADMIN_PASSWORD`, plus a `Default Organization` and `Default Workspace` that all initial members join.

Expose port 8080 to your developers over HTTPS using whatever method fits your infrastructure — the app has no opinion on how you terminate TLS.

> **Building `collector.exe` for Windows** — the build-collector-exe GitHub Actions workflow runs on each tag push (`v*`) and produces a self-contained `collector.exe` on a Windows runner. Download the artifact and drop it at `packages/collector/dist/collector.exe` before `docker compose build`; the Dockerfile copies it into the runtime image so Windows users can install without Node.js. If absent, the install flow falls back to `collector.js` + Node.js.

## 3. Invite a developer

1. Log in as a Platform Owner / Platform Admin → **Team** page (under Organization)
2. Enter their email, choose **Developer** or **Admin**, pick the destination org + workspace, click **Generate link**
3. Send them the invite link (valid 7 days, one-time use)

For bulk onboarding, use **Bulk invite** to paste a list of emails at once, or set up **Domain auto-assign rules** (Manage → Domain rules) so anyone signing in with a matching email domain lands in a specific org + workspace automatically.

## 4. Developer onboarding

When the developer clicks the invite link:

1. They sign in with their Google account
2. Their **API key** is shown once — they must copy it immediately
3. On each machine they use, they run the installer (the dashboard shows the exact command with their key pre-filled):

**macOS / Linux:**
```bash
curl -sSL https://your-server/install.sh | CHUB_API_KEY=chub_xxx sh
```

**Windows (one command, admin not required — auto-detects):**
```powershell
$env:CHUB_API_KEY = 'chub_xxx'
iwr "https://your-server/install.ps1" -OutFile "$env:TEMP\install-chub.ps1" -UseBasicParsing
powershell -ExecutionPolicy Bypass -File "$env:TEMP\install-chub.ps1"
```

The installer downloads the collector, initializes the config, and registers a background daemon:

| Platform | Backend | Starts on |
|---|---|---|
| macOS | launchd LaunchAgent | login |
| Linux | systemd user service | login |
| Windows (Administrator shell) | NSSM Windows Service | **boot** — runs without anyone logged in |
| Windows (standard user) | Hidden Scheduled Task | user logon — no UAC prompt, no IT admin needed |

The Windows installer prefers a self-contained `collector.exe` (no Node.js required) if the Hub has one deployed; otherwise it falls back to `collector.js` + Node.js ≥ 18.

### Manual setup (without the install script)

```bash
# Download the collector
curl -sSL https://your-server/download/collector.js -o collector.js

# Initialize
node collector.js init --server https://your-server --api-key chub_xxx

# Install as a background daemon
node collector.js install

# Verify
node collector.js status --check
```

The collector runs every 5 minutes (configurable via `intervalMinutes` in `config.json`). If the server is unreachable, payloads are queued locally and retried automatically.

If a Windows install fails, re-run with `--verbose` for full diagnostic output:
```powershell
& "$env:APPDATA\claude-usage-hub\collector.exe" install --verbose
```

## Roles & permissions

Five tiers — two are platform-level *roles* (stored on the user), and two are *grants* on individual orgs/workspaces (stored in join tables, so one person can hold any combination).

| Role | Type | Can do |
|---|---|---|
| **Platform Owner** | Role (singular) | Everything. The one immutable owner — can transfer ownership but not be removed. |
| **Platform Admin** | Role (many) | Manage orgs / workspaces / members across the entire platform. Cannot transfer the Platform Owner role. |
| **Org Owner** | Grant (per-org) | Manage workspaces, members, and grants inside a specific org. Can own multiple orgs. |
| **Workspace Owner** | Grant (per-workspace) | Manage one specific workspace inside an org. |
| **Developer** | Role (default) | See only their own usage. No admin or management surface. |

## Organizations & workspaces

- **Organizations** are top-level, parallel — there's no hierarchy between them.
- **Workspaces** nest inside orgs.
- Every user has one *active* org + workspace membership at a time. Moves are time-bounded — historical usage stays attributed to where it was generated, only new entries flow to the new location.
- The org marked `DEFAULT` in the Manage UI is the migration-origin org — the system refuses to delete it because it holds pre-migration data, but it behaves identically to any other org for inviting, scoping dashboards, and so on.

## Data management

Platform Admins can wipe usage data at any level:

- **All data** — Settings page → Danger Zone
- **One member's data** — Organization → Overview → member row → wipe icon
- **One machine's data** — member's detail page → Machines section → trash icon

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MODE` | Yes | Set to `team` |
| `JWT_SECRET` | Yes | Random 32+ char string for signing tokens |
| `ADMIN_EMAIL` | Yes | Email for the bootstrap Platform Owner |
| `ADMIN_PASSWORD` | Yes | Password for the bootstrap Platform Owner |
| `GOOGLE_CLIENT_ID` | Yes | OAuth client ID from Google Cloud Console |
| `ALLOWED_DOMAIN` | Yes | Google Workspace domain to restrict login to |
| `PORT` | No | Server port (default: `8080`) |
| `DB_PATH` | No | SQLite database path (default: `/data/usage.db`) |
| `RETENTION_DAYS` | No | Days of data to retain (default: `90`) |
| `NSSM_PATH` | No | Override the path to nssm.exe served at `/download/nssm.exe` |
| `COLLECTOR_EXE_PATH` | No | Override the path to collector.exe served at `/download/collector.exe` |
| `COLLECTOR_BUNDLE_PATH` | No | Override the path to collector.bundle.cjs served at `/download/collector.js` |
