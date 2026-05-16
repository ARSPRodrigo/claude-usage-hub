import { Hono } from 'hono';
import { createRequire } from 'node:module';
import type { TimeRange, AuthContext } from '@claude-usage-hub/shared';

const _require = createRequire(import.meta.url);
const APP_VERSION: string = (_require('../../package.json') as { version: string }).version;
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
  getAggregateTokensByTier,
  getDeveloperStats,
} from '../db/repository.js';
import { computeComparisonCosts, isPlatformAdminRole } from '@claude-usage-hub/shared';
import { listOrganizations, listWorkspaces } from '../db/org-repository.js';
import { ingestPayload } from '../services/ingest.js';

const VALID_RANGES = new Set(['5h', '24h', '7d', '30d', 'all']);

function parseRange(c: { req: { query: (key: string) => string | undefined } }): TimeRange {
  const range = c.req.query('range') ?? '24h';
  return VALID_RANGES.has(range) ? (range as TimeRange) : '24h';
}

/**
 * Get the developer scope for personal /dashboard/* queries.
 *
 * Always returns the caller's developerId — even for admins. The
 * /dashboard/* routes are the user's *personal* view; admins who want
 * org-wide aggregates use /admin/* endpoints instead. Local mode (no
 * auth) returns undefined so the single-user instance sees everything.
 */
function getDeveloperScope(c: Context): string | undefined {
  const auth = c.get('auth') as AuthContext | undefined;
  if (!auth) return undefined; // local mode — no scoping
  return auth.developerId;
}

const api = new Hono<AppEnv>();

// Health check (always public)
api.get('/health', (c) => {
  return c.json({
    status: 'ok',
    entryCount: getEntryCount(),
    lastEntry: getLastEntryTimestamp(),
    version: APP_VERSION,
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

  const result = ingestPayload(body, auth?.apiKeyId);
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

// Cost comparison (personal) — always scoped to caller's developerId, even for admins
api.get('/dashboard/cost-comparison', (c) => {
  const range = parseRange(c);
  const auth = c.get('auth') as AuthContext | undefined;
  const personalScope = auth?.developerId; // always personal, not org-wide
  const tiers = getAggregateTokensByTier(range, personalScope);

  const opusComparisons = computeComparisonCosts({
    inputTokens: tiers.opus.inputTokens,
    outputTokens: tiers.opus.outputTokens,
    cacheCreationTokens: tiers.opus.cacheCreationTokens,
    cacheReadTokens: tiers.opus.cacheReadTokens,
  }).filter((c) => c.tier === 'opus');

  const sonnetComparisons = computeComparisonCosts({
    inputTokens: tiers.sonnet.inputTokens,
    outputTokens: tiers.sonnet.outputTokens,
    cacheCreationTokens: tiers.sonnet.cacheCreationTokens,
    cacheReadTokens: tiers.sonnet.cacheReadTokens,
  }).filter((c) => c.tier === 'sonnet');

  return c.json({
    opus: {
      tokens: {
        inputTokens: tiers.opus.inputTokens,
        outputTokens: tiers.opus.outputTokens,
        cacheCreationTokens: tiers.opus.cacheCreationTokens,
        cacheReadTokens: tiers.opus.cacheReadTokens,
        totalTokens: tiers.opus.inputTokens + tiers.opus.outputTokens + tiers.opus.cacheCreationTokens + tiers.opus.cacheReadTokens,
      },
      actualCost: tiers.opus.actualCost,
      comparisons: opusComparisons,
    },
    sonnet: {
      tokens: {
        inputTokens: tiers.sonnet.inputTokens,
        outputTokens: tiers.sonnet.outputTokens,
        cacheCreationTokens: tiers.sonnet.cacheCreationTokens,
        cacheReadTokens: tiers.sonnet.cacheReadTokens,
        totalTokens: tiers.sonnet.inputTokens + tiers.sonnet.outputTokens + tiers.sonnet.cacheCreationTokens + tiers.sonnet.cacheReadTokens,
      },
      actualCost: tiers.sonnet.actualCost,
      comparisons: sonnetComparisons,
    },
  });
});

// Sessions
api.get('/sessions', (c) => {
  const range = parseRange(c);
  const scope = getDeveloperScope(c);
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '50', 10) || 50, 1), 200);
  const offset = Math.min(Math.max(parseInt(c.req.query('offset') ?? '0', 10) || 0, 0), 1_000_000);
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

// Leaderboard — visible to all authenticated members.
// Platform admins see everyone; regular developers are scoped to their active workspace.
api.get('/dashboard/leaderboard', (c) => {
  const range = parseRange(c);
  const auth = c.get('auth') as AuthContext | undefined;
  const scope = (!auth || isPlatformAdminRole(auth.role))
    ? {}
    : {
        organizationId: auth.activeOrgId ?? undefined,
        workspaceId: auth.activeWorkspaceId ?? undefined,
      };
  return c.json(getDeveloperStats(range, scope));
});

// ── Organizations & workspaces (Phase 2) ─────────────────────────────────
// Listings are scoped to what the caller can see:
//  - platform admin / owner: all orgs and all workspaces
//  - org owner: only orgs they own (plus their active org)
//  - developer: only their active org/workspace (so the UI badge works)
//
// These endpoints sit under /dashboard so the existing JWT middleware applies.

api.get('/dashboard/orgs', (c) => {
  const auth = c.get('auth') as AuthContext | undefined;
  const all = listOrganizations();
  if (!auth) return c.json(all);
  if (isPlatformAdminRole(auth.role)) return c.json(all);

  const allowedIds = new Set<string>([
    ...(auth.ownedOrgIds ?? []),
    ...(auth.activeOrgId ? [auth.activeOrgId] : []),
  ]);
  return c.json(all.filter((o) => allowedIds.has(o.id)));
});

api.get('/dashboard/workspaces', (c) => {
  const auth = c.get('auth') as AuthContext | undefined;
  const orgId = c.req.query('orgId');
  const all = listWorkspaces(orgId);
  if (!auth) return c.json(all);
  if (isPlatformAdminRole(auth.role)) return c.json(all);

  // Org owner: see all workspaces in their owned orgs.
  // Developer: only their active workspace.
  const ownedOrgs = new Set(auth.ownedOrgIds ?? []);
  if (orgId && ownedOrgs.has(orgId)) return c.json(all);

  const activeWs = auth.activeWorkspaceId;
  return c.json(all.filter((w) => w.id === activeWs));
});

export { api };
