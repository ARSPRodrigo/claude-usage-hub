import { Hono } from 'hono';
import { COLLECTOR_VERSION } from '@claude-usage-hub/shared';
import type { TimeRange } from '@claude-usage-hub/shared';
import {
  getDashboardStats,
  getTokenTimeseries,
  getCostTrend,
  getModelMix,
  getSessions,
  getProjects,
  getEntryCount,
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

// Sessions
api.get('/sessions', (c) => {
  const range = parseRange(c);
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 200);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);
  return c.json(getSessions(range, limit, offset));
});

// Projects
api.get('/projects', (c) => {
  const range = parseRange(c);
  return c.json(getProjects(range));
});

export { api };
