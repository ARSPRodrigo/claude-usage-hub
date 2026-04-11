# API Reference

Base URL: `http://your-server:8080`

All responses are JSON. Authenticated endpoints return `401` if the token is missing or expired, `403` if the role is insufficient.

## Authentication

**Local mode:** No authentication required on any endpoint.

**Team mode:**
- Dashboard routes require a JWT: `Authorization: Bearer <token>`
- Collector ingest requires an API key: `X-API-Key: chub_xxx...`
- Admin routes require JWT + Owner or Primary Owner role

---

## Public Endpoints

### `GET /api/v1/health`

Server status and entry count.

**Response**
```json
{
  "status": "ok",
  "entryCount": 12483,
  "lastEntry": "2026-04-11T09:32:00Z",
  "version": "0.2.0"
}
```

### `GET /api/v1/config`

Public server configuration for the dashboard (Google client ID, deployment mode).

**Response**
```json
{
  "mode": "team",
  "googleClientId": "xxxx.apps.googleusercontent.com",
  "allowedDomain": "yourcompany.com"
}
```

---

## Auth Endpoints (Team Mode)

### `POST /auth/login`

Authenticate with email and password (admin bootstrap account).

**Body**
```json
{ "email": "admin@example.com", "password": "..." }
```

**Response**
```json
{
  "token": "<JWT>",
  "user": { "id": "...", "email": "...", "displayName": "...", "role": "primary_owner", "developerId": "..." }
}
```

### `POST /auth/google/verify`

Exchange a Google ID token for a JWT. Called by the dashboard after the user signs in with Google.

**Body**
```json
{ "idToken": "<Google ID token>" }
```

**Response** — same shape as `/auth/login`

### `POST /auth/logout`

No-op (JWTs are stateless). Client should discard the token.

**Response** `{ "ok": true }`

### `GET /auth/me`

Returns the current authenticated user. Requires JWT.

**Response**
```json
{
  "id": "...",
  "email": "user@example.com",
  "displayName": "Alice",
  "role": "developer",
  "developerId": "dev-abc12345"
}
```

### `POST /auth/invite/accept`

Accept an invitation link. Called after the invited user signs in with Google.

**Body**
```json
{
  "token": "<invite token from URL>",
  "idToken": "<Google ID token>",
  "label": "My MacBook"
}
```

**Response**
```json
{
  "token": "<JWT>",
  "user": { ... },
  "apiKey": {
    "id": "...",
    "key": "chub_...",
    "keyPrefix": "chub_abc123",
    "label": "My MacBook",
    "developerId": "dev-abc12345"
  }
}
```

> The `key` field is returned **once only** — it is not stored on the server.

---

## Collector Endpoints

### `POST /api/v1/ingest`

Submit usage entries from the collector. Requires API key in team mode.

**Headers (team mode):** `X-API-Key: chub_xxx`

**Body**
```json
{
  "developerId": "dev-abc12345",
  "entries": [
    {
      "sessionId": "...",
      "messageId": "...",
      "requestId": "...",
      "timestamp": "2026-04-11T09:00:00Z",
      "model": "claude-sonnet-4-6",
      "inputTokens": 1200,
      "outputTokens": 450,
      "cacheCreationTokens": 0,
      "cacheReadTokens": 800,
      "costUsd": 0.0142,
      "projectAlias": "abc123",
      "serviceTier": "standard"
    }
  ]
}
```

**Response**
```json
{ "inserted": 14 }
```

Insertion is idempotent — duplicate `(messageId, requestId)` pairs are silently ignored.

### `GET /api/v1/me`

Returns the developer identity associated with an API key. Used by the collector during `init` to fetch its server-assigned `developerId`. Requires API key.

**Response**
```json
{
  "developerId": "dev-abc12345",
  "userId": "...",
  "email": "alice@example.com"
}
```

---

## Dashboard Endpoints

All accept a `?range=` query parameter: `5h` | `24h` | `7d` | `30d` | `all` (default: `24h`).

In team mode, developer-role users see only their own data. Owners see all data.

### `GET /api/v1/dashboard/stats`

Aggregate totals for the selected time range.

**Response**
```json
{
  "tokensToday": 284300,
  "costToday": 4.21,
  "sessionsToday": 12,
  "inputTokens": 180000,
  "outputTokens": 62000,
  "cacheCreationTokens": 28000,
  "cacheReadTokens": 14300
}
```

### `GET /api/v1/dashboard/tokens-timeseries`

Token usage over time, bucketed by range.

**Response** — array of:
```json
{ "bucket": "2026-04-11T08:00:00Z", "model": "claude-sonnet-4-6", "totalTokens": 12400, "costUsd": 0.18 }
```

### `GET /api/v1/dashboard/cost-trend`

Daily cost totals.

**Response** — array of:
```json
{ "date": "2026-04-11", "costUsd": 4.21 }
```

### `GET /api/v1/dashboard/model-mix`

Token distribution by model.

**Response** — array of:
```json
{ "model": "claude-sonnet-4-6", "totalTokens": 210000, "costUsd": 3.82, "percentage": 73.9 }
```

### `GET /api/v1/dashboard/cost-breakdown`

Cost split by token type.

**Response**
```json
{
  "inputCost": 1.20,
  "outputCost": 2.48,
  "cacheCreationCost": 0.33,
  "cacheReadCost": 0.20
}
```

---

## Sessions

### `GET /api/v1/sessions`

Paginated list of sessions.

**Query params:** `range`, `limit` (max 200, default 50), `offset` (default 0)

**Response**
```json
{
  "total": 284,
  "sessions": [
    {
      "sessionId": "...",
      "name": "golden-harbor-drift",
      "startTime": "2026-04-11T08:12:00Z",
      "endTime": "2026-04-11T09:44:00Z",
      "durationMinutes": 92,
      "models": ["claude-sonnet-4-6"],
      "totalTokens": 48200,
      "costUsd": 0.84
    }
  ]
}
```

### `GET /api/v1/sessions/:id/detail`

Per-model token breakdown for a session.

**Response** — array of:
```json
{ "model": "claude-sonnet-4-6", "inputTokens": 28000, "outputTokens": 9200, "cacheCreationTokens": 8000, "cacheReadTokens": 3000, "costUsd": 0.72 }
```

---

## Projects

### `GET /api/v1/projects`

Usage grouped by project alias.

**Query params:** `range`

**Response** — array of:
```json
{
  "projectAlias": "abc123",
  "totalTokens": 182000,
  "costUsd": 2.94,
  "sessionCount": 8,
  "percentage": 42.1
}
```

### `GET /api/v1/projects/:alias/detail`

Per-model breakdown for a project.

**Response** — array of:
```json
{ "model": "claude-sonnet-4-6", "inputTokens": 120000, "outputTokens": 38000, "cacheCreationTokens": 18000, "cacheReadTokens": 6000, "costUsd": 2.41 }
```

---

## Profile (Team Mode)

Requires JWT. All operations scoped to the authenticated user.

### `GET /api/v1/profile`

Current user info.

### `PATCH /api/v1/profile`

Update display name.

**Body** `{ "displayName": "Alice" }`

### `GET /api/v1/profile/api-keys`

List own API keys.

**Response** — array of:
```json
{
  "id": "...",
  "keyPrefix": "chub_abc123",
  "label": "My MacBook",
  "developerId": "dev-abc12345",
  "createdAt": "2026-04-01T10:00:00Z",
  "revokedAt": null,
  "lastUsedAt": "2026-04-11T09:32:00Z"
}
```

### `POST /api/v1/profile/api-keys`

Generate a new API key for another machine.

**Body** `{ "label": "Linux VM" }`

**Response** — includes `key` field (shown once only).

### `DELETE /api/v1/profile/api-keys/:id`

Revoke an API key.

---

## Admin (Team Mode — Owner+ Only)

### Invitations

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/admin/invitations` | Create invite link. Body: `{ email, role: "developer"\|"owner" }` |
| `GET` | `/api/v1/admin/invitations` | List all invitations with status |
| `DELETE` | `/api/v1/admin/invitations/:id` | Revoke an invitation |

### Members

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/admin/developers` | List all users |
| `PATCH` | `/api/v1/admin/developers/:id/role` | Change role. Body: `{ role: "developer"\|"owner" }` |
| `GET` | `/api/v1/admin/developers/:developerId/machines` | Per-machine stats for a member |
| `DELETE` | `/api/v1/admin/developers/:developerId/data` | Wipe all usage data for a member |

### API Keys

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/admin/api-keys` | List all API keys |
| `DELETE` | `/api/v1/admin/api-keys/:id` | Revoke an API key |
| `DELETE` | `/api/v1/admin/api-keys/:id/data` | Wipe usage data for one machine |

### Stats

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/admin/stats/overview` | Org-wide totals. Query: `range` |
| `GET` | `/api/v1/admin/stats/developers` | Per-member usage breakdown |
| `GET` | `/api/v1/admin/developer-stats/:developerId` | Scoped stats for one member |
| `GET` | `/api/v1/admin/developer-timeseries/:developerId` | Scoped timeseries for one member |

### Settings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/admin/settings` | Current settings (retentionDays, allowedDomain, mode) |
| `PATCH` | `/api/v1/admin/settings` | Update retention. Body: `{ retentionDays: 90 }` |
| `DELETE` | `/api/v1/admin/data` | Wipe all usage data for the entire org |

---

## Download Endpoints

Always public — used by the install scripts.

| Path | Description |
|------|-------------|
| `GET /download/collector.js` | Bundled collector agent (Node.js CJS) |
| `GET /install.sh` | macOS/Linux install script |
| `GET /install.ps1` | Windows PowerShell install script |
