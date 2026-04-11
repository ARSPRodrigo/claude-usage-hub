# Team Mode Setup

Team mode runs a central server that all developers on your team push usage data to. Owners see everyone's data; developers see their own.

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

The server listens on port 8080. On first boot it creates the admin account from `ADMIN_EMAIL` and `ADMIN_PASSWORD` automatically.

Expose port 8080 to your developers over HTTPS using whatever method fits your infrastructure — the app has no opinion on how you terminate TLS.

## 3. Invite a developer

1. Log in as an owner → **Team** page
2. Enter their email, choose **Member** or **Owner**, click **Generate link**
3. Send them the invite link (valid for 7 days, one-time use)

## 4. Developer onboarding

When the developer clicks the invite link:

1. They sign in with their org Google account
2. Their **API key** is shown once — they must copy it immediately
3. On each machine they use, they run the installer:

**macOS / Linux:**
```bash
curl -sSL https://your-server/install.sh | CHUB_API_KEY=chub_xxx sh
```

**Windows (PowerShell):**
```powershell
$env:CHUB_API_KEY='chub_xxx'; irm https://your-server/install.ps1 | iex
```

The installer downloads the collector from the server, initializes the config, and registers a background daemon (launchd on macOS, systemd on Linux, Task Scheduler on Windows). Node.js >= 18 must be installed on the developer's machine.

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

The collector runs every 5 minutes. If the server is unreachable, payloads are queued locally and retried automatically.

## Roles

| Role | What they can do |
|------|-----------------|
| Primary Owner | Everything; role cannot be changed |
| Owner | See all data, invite members, wipe data, manage settings |
| Developer | See their own data only |

## Data management

Owners can wipe usage data at any level:

- **All data** — Settings page → Danger Zone
- **One member's data** — Overview page → member row → wipe icon
- **One machine's data** — member's detail page → Machines section → wipe icon

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MODE` | Yes | Set to `team` |
| `JWT_SECRET` | Yes | Random 32+ char string for signing tokens |
| `ADMIN_EMAIL` | Yes | Email for the bootstrap admin account |
| `ADMIN_PASSWORD` | Yes | Password for the bootstrap admin account |
| `GOOGLE_CLIENT_ID` | Yes | OAuth client ID from Google Cloud Console |
| `ALLOWED_DOMAIN` | Yes | Google Workspace domain to restrict login to |
| `PORT` | No | Server port (default: `8080`) |
| `DB_PATH` | No | SQLite database path (default: `/data/usage.db`) |
| `RETENTION_DAYS` | No | Days of data to retain (default: `90`) |
