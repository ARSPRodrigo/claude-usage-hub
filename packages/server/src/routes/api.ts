import { Hono } from 'hono';
import { COLLECTOR_VERSION } from '@claude-usage-hub/shared';
import type { TimeRange, AuthContext } from '@claude-usage-hub/shared';
import type { AppEnv } from '../env.js';

type Context = import('hono').Context<AppEnv>;
import {
  getDashboardStats,
  getTokenTimeseries,
  getCostTrend,
  getCostBreakdown,
  getModelMix,
  getSessions,
  getSessionDetail,
  getSessionCount,
  getProjects,
  getProjectDetail,
  getEntryCount,
  getLastEntryTimestamp,
} from '../db/repository.js';
import { ingestPayload } from '../services/ingest.js';

const VALID_RANGES = new Set(['5h', '24h', '7d', '30d', 'all']);

function parseRange(c: { req: { query: (key: string) => string | undefined } }): TimeRange {
  const range = c.req.query('range') ?? '24h';
  return VALID_RANGES.has(range) ? (range as TimeRange) : '24h';
}

/**
 * Get the developer scope for queries.
 * Returns developerId for developer role (scoped), undefined for admin roles/local (all data).
 */
function getDeveloperScope(c: Context): string | undefined {
  const auth = c.get('auth') as AuthContext | undefined;
  if (!auth) return undefined; // local mode — no scoping
  return auth.role === 'developer' ? auth.developerId : undefined;
}

const api = new Hono<AppEnv>();

// Health check (always public)
api.get('/health', (c) => {
  return c.json({
    status: 'ok',
    entryCount: getEntryCount(),
    lastEntry: getLastEntryTimestamp(),
    version: COLLECTOR_VERSION,
  });
});

// Public config for the dashboard (Google client ID, mode)
api.get('/config', (c) => {
  return c.json({
    mode: process.env['MODE'] ?? 'local',
    googleClientId: process.env['GOOGLE_CLIENT_ID'] ?? '',
    allowedDomain: process.env['ALLOWED_DOMAIN'] ?? '',
  });
});

// Ingest endpoint
api.post('/ingest', async (c) => {
  const body = await c.req.json();

  // In team mode, verify developerId matches the API key owner
  const auth = c.get('auth') as AuthContext | undefined;
  if (auth && body.developerId && body.developerId !== auth.developerId) {
    return c.json(
      { error: 'developerId mismatch: API key is not authorized for this developer' },
      403,
    );
  }

  const result = ingestPayload(body);
  if (result.error) {
    return c.json({ error: result.error }, 400);
  }
  return c.json({ inserted: result.inserted });
});

// Collector identity — returns server-assigned developerId for the API key
api.get('/me', (c) => {
  const auth = c.get('auth') as AuthContext | undefined;
  if (!auth) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  return c.json({
    developerId: auth.developerId,
    userId: auth.userId,
    email: auth.email,
  });
});

// Dashboard stats
api.get('/dashboard/stats', (c) => {
  const range = parseRange(c);
  return c.json(getDashboardStats(range, getDeveloperScope(c)));
});

// Token usage timeseries
api.get('/dashboard/tokens-timeseries', (c) => {
  const range = parseRange(c);
  return c.json(getTokenTimeseries(range, getDeveloperScope(c)));
});

// Cost trend
api.get('/dashboard/cost-trend', (c) => {
  const range = parseRange(c);
  return c.json(getCostTrend(range, getDeveloperScope(c)));
});

// Model mix
api.get('/dashboard/model-mix', (c) => {
  const range = parseRange(c);
  return c.json(getModelMix(range, getDeveloperScope(c)));
});

// Cost breakdown
api.get('/dashboard/cost-breakdown', (c) => {
  const range = parseRange(c);
  return c.json(getCostBreakdown(range, getDeveloperScope(c)));
});

// Sessions
api.get('/sessions', (c) => {
  const range = parseRange(c);
  const scope = getDeveloperScope(c);
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 200);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);
  const total = getSessionCount(range, scope);
  return c.json({ sessions: getSessions(range, limit, offset, scope), total });
});

// Session detail
api.get('/sessions/:id/detail', (c) => {
  const sessionId = c.req.param('id');
  return c.json(getSessionDetail(sessionId, getDeveloperScope(c)));
});

// Projects
api.get('/projects', (c) => {
  const range = parseRange(c);
  return c.json(getProjects(range, getDeveloperScope(c)));
});

// Project detail
api.get('/projects/:alias/detail', (c) => {
  const alias = c.req.param('alias');
  const range = parseRange(c);
  return c.json(getProjectDetail(alias, range, getDeveloperScope(c)));
});

export { api };
