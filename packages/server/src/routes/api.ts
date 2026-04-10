import { Hono } from 'hono';
import { COLLECTOR_VERSION } from '@claude-usage-hub/shared';
import type { TimeRange } from '@claude-usage-hub/shared';
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

const api = new Hono();

// Health check
api.get('/health', (c) => {
  return c.json({
    status: 'ok',
    mode: 'local',
    entryCount: getEntryCount(),
    lastEntry: getLastEntryTimestamp(),
    version: COLLECTOR_VERSION,
  });
});

// Ingest endpoint (team mode)
api.post('/ingest', async (c) => {
  const body = await c.req.json();
  const result = ingestPayload(body);
  if (result.error) {
    return c.json({ error: result.error }, 400);
  }
  return c.json({ inserted: result.inserted });
});

// Dashboard stats
api.get('/dashboard/stats', (c) => {
  const range = parseRange(c);
  return c.json(getDashboardStats(range));
});

// Token usage timeseries
api.get('/dashboard/tokens-timeseries', (c) => {
  const range = parseRange(c);
  return c.json(getTokenTimeseries(range));
});

// Cost trend
api.get('/dashboard/cost-trend', (c) => {
  const range = parseRange(c);
  return c.json(getCostTrend(range));
});

// Model mix
api.get('/dashboard/model-mix', (c) => {
  const range = parseRange(c);
  return c.json(getModelMix(range));
});

// Cost breakdown
api.get('/dashboard/cost-breakdown', (c) => {
  const range = parseRange(c);
  return c.json(getCostBreakdown(range));
});

// Sessions
api.get('/sessions', (c) => {
  const range = parseRange(c);
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 200);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);
  const total = getSessionCount(range);
  return c.json({ sessions: getSessions(range, limit, offset), total });
});

// Session detail
api.get('/sessions/:id/detail', (c) => {
  const sessionId = c.req.param('id');
  return c.json(getSessionDetail(sessionId));
});

// Projects
api.get('/projects', (c) => {
  const range = parseRange(c);
  return c.json(getProjects(range));
});

// Project detail
api.get('/projects/:alias/detail', (c) => {
  const alias = c.req.param('alias');
  const range = parseRange(c);
  return c.json(getProjectDetail(alias, range));
});

export { api };
