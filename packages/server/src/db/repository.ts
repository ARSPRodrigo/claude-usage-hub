import { TIME_RANGE_HOURS } from '@claude-usage-hub/shared';
import type {
  DashboardStats,
  TimeseriesPoint,
  CostTrendPoint,
  ModelMixEntry,
  SessionRow,
  ProjectRow,
  SessionDetailRow,
  CostBreakdown,
  EnrichedEntry,
  TimeRange,
} from '@claude-usage-hub/shared';
import { getRawDb } from './connection.js';

/**
 * Get the ISO timestamp for "now minus N hours".
 * Returns null for 'all' (no time filter).
 */
function cutoffTime(range: TimeRange): string | null {
  if (range === 'all') return null;
  const hours = TIME_RANGE_HOURS[range] ?? 24;
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  return cutoff.toISOString();
}

/** Build a WHERE clause fragment, or empty string for 'all'. */
function whereClause(range: TimeRange): { sql: string; params: string[] } {
  const cutoff = cutoffTime(range);
  if (!cutoff) return { sql: '', params: [] };
  return { sql: 'WHERE timestamp >= ?', params: [cutoff] };
}

/**
 * Get the time bucket SQL expression based on range.
 * 5h → 15min, 24h → 1h, 7d → 6h, 30d → 1d, all → 1d
 */
function bucketExpression(range: TimeRange): string {
  switch (range) {
    case '5h':
      return `strftime('%Y-%m-%dT%H:', timestamp) || printf('%02d', (cast(strftime('%M', timestamp) as integer) / 15) * 15) || ':00Z'`;
    case '24h':
      return `strftime('%Y-%m-%dT%H:00:00Z', timestamp)`;
    case '7d':
      return `strftime('%Y-%m-%dT', timestamp) || printf('%02d', (cast(strftime('%H', timestamp) as integer) / 6) * 6) || ':00:00Z'`;
    case '30d':
    case 'all':
      return `strftime('%Y-%m-%dT00:00:00Z', timestamp)`;
    default:
      return `strftime('%Y-%m-%dT%H:00:00Z', timestamp)`;
  }
}

/**
 * Batch insert enriched entries. Uses INSERT OR IGNORE for idempotency.
 * Returns the number of rows actually inserted.
 */
export function insertEntries(entries: EnrichedEntry[]): number {
  if (entries.length === 0) return 0;

  const raw = getRawDb();
  const stmt = raw.prepare(`
    INSERT OR IGNORE INTO usage_entries
      (session_id, message_id, request_id, timestamp, model,
       input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens,
       service_tier, developer_id, project_alias, cost_usd)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  const transaction = raw.transaction(() => {
    for (const e of entries) {
      const result = stmt.run(
        e.sessionId,
        e.messageId,
        e.requestId,
        e.timestamp,
        e.model,
        e.usage.inputTokens,
        e.usage.outputTokens,
        e.usage.cacheCreationTokens,
        e.usage.cacheReadTokens,
        e.serviceTier,
        e.developerId,
        e.projectAlias,
        e.costUsd,
      );
      inserted += result.changes;
    }
  });

  transaction();
  return inserted;
}

/**
 * Get dashboard overview stats for a time range.
 */
export function getDashboardStats(range: TimeRange): DashboardStats {
  const raw = getRawDb();
  const where = whereClause(range);

  const row = raw
    .prepare(
      `
    SELECT
      COALESCE(SUM(input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens), 0) as tokens,
      COALESCE(SUM(cost_usd), 0) as cost,
      COUNT(DISTINCT session_id) as sessions
    FROM usage_entries
    ${where.sql}
  `,
    )
    .get(...where.params) as { tokens: number; cost: number; sessions: number };

  // Active sessions: sessions with activity in last 5 hours
  const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
  const activeRow = raw
    .prepare(
      `SELECT COUNT(DISTINCT session_id) as active FROM usage_entries WHERE timestamp >= ?`,
    )
    .get(fiveHoursAgo) as { active: number };

  return {
    tokensToday: row.tokens,
    costToday: row.cost,
    activeSessions: activeRow.active,
    totalSessions: row.sessions,
  };
}

/**
 * Get token usage timeseries grouped by time bucket and model.
 */
export function getTokenTimeseries(range: TimeRange): TimeseriesPoint[] {
  const raw = getRawDb();
  const where = whereClause(range);
  const bucket = bucketExpression(range);

  const rows = raw
    .prepare(
      `
    SELECT
      ${bucket} as bucket,
      model,
      SUM(input_tokens) as input_tokens,
      SUM(output_tokens) as output_tokens,
      SUM(cache_creation_tokens) as cache_creation_tokens,
      SUM(cache_read_tokens) as cache_read_tokens,
      SUM(input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens) as total_tokens,
      SUM(cost_usd) as cost_usd
    FROM usage_entries
    ${where.sql}
    GROUP BY bucket, model
    ORDER BY bucket ASC, model ASC
  `,
    )
    .all(...where.params) as Array<{
    bucket: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cache_creation_tokens: number;
    cache_read_tokens: number;
    total_tokens: number;
    cost_usd: number;
  }>;

  return rows.map((r) => ({
    bucket: r.bucket,
    model: r.model,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    cacheCreationTokens: r.cache_creation_tokens,
    cacheReadTokens: r.cache_read_tokens,
    totalTokens: r.total_tokens,
    costUsd: r.cost_usd,
  }));
}

/**
 * Get daily cost trend.
 */
export function getCostTrend(range: TimeRange): CostTrendPoint[] {
  const raw = getRawDb();
  const where = whereClause(range);

  const rows = raw
    .prepare(
      `
    SELECT
      date(timestamp) as date,
      SUM(cost_usd) as cost_usd
    FROM usage_entries
    ${where.sql}
    GROUP BY date(timestamp)
    ORDER BY date ASC
  `,
    )
    .all(...where.params) as Array<{ date: string; cost_usd: number }>;

  return rows.map((r) => ({
    date: r.date,
    costUsd: r.cost_usd,
  }));
}

/**
 * Get model usage breakdown.
 */
export function getModelMix(range: TimeRange): ModelMixEntry[] {
  const raw = getRawDb();
  const where = whereClause(range);

  const rows = raw
    .prepare(
      `
    SELECT
      model,
      SUM(input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens) as total_tokens,
      SUM(cost_usd) as cost_usd
    FROM usage_entries
    ${where.sql}
    GROUP BY model
    ORDER BY total_tokens DESC
  `,
    )
    .all(...where.params) as Array<{ model: string; total_tokens: number; cost_usd: number }>;

  const grandTotal = rows.reduce((sum, r) => sum + r.total_tokens, 0);

  return rows.map((r) => ({
    model: r.model,
    totalTokens: r.total_tokens,
    costUsd: r.cost_usd,
    percentage: grandTotal > 0 ? (r.total_tokens / grandTotal) * 100 : 0,
  }));
}

/**
 * Get session summaries.
 */
export function getSessions(
  range: TimeRange,
  limit: number = 50,
  offset: number = 0,
): SessionRow[] {
  const raw = getRawDb();
  const where = whereClause(range);

  const rows = raw
    .prepare(
      `
    SELECT
      session_id,
      MIN(timestamp) as first_seen,
      MAX(timestamp) as last_seen,
      GROUP_CONCAT(DISTINCT model) as models,
      SUM(input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens) as total_tokens,
      SUM(cost_usd) as cost_usd,
      project_alias
    FROM usage_entries
    ${where.sql}
    GROUP BY session_id
    ORDER BY MAX(timestamp) DESC
    LIMIT ? OFFSET ?
  `,
    )
    .all(...where.params, limit, offset) as Array<{
    session_id: string;
    first_seen: string;
    last_seen: string;
    models: string;
    total_tokens: number;
    cost_usd: number;
    project_alias: string;
  }>;

  return rows.map((r) => ({
    sessionId: r.session_id,
    firstSeen: r.first_seen,
    lastSeen: r.last_seen,
    models: r.models ? r.models.split(',') : [],
    totalTokens: r.total_tokens,
    costUsd: r.cost_usd,
    projectAlias: r.project_alias,
  }));
}

/**
 * Get project summaries.
 */
export function getProjects(range: TimeRange): ProjectRow[] {
  const raw = getRawDb();
  const where = whereClause(range);

  const rows = raw
    .prepare(
      `
    SELECT
      project_alias,
      COUNT(DISTINCT session_id) as session_count,
      SUM(input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens) as total_tokens,
      SUM(cost_usd) as cost_usd
    FROM usage_entries
    ${where.sql}
    GROUP BY project_alias
    ORDER BY total_tokens DESC
  `,
    )
    .all(...where.params) as Array<{
    project_alias: string;
    session_count: number;
    total_tokens: number;
    cost_usd: number;
  }>;

  return rows.map((r) => ({
    projectAlias: r.project_alias,
    sessionCount: r.session_count,
    totalTokens: r.total_tokens,
    costUsd: r.cost_usd,
  }));
}

/**
 * Get per-model breakdown for a single session.
 */
export function getSessionDetail(sessionId: string): SessionDetailRow[] {
  const raw = getRawDb();

  const rows = raw
    .prepare(
      `
    SELECT
      model,
      SUM(input_tokens) as input_tokens,
      SUM(output_tokens) as output_tokens,
      SUM(cache_creation_tokens) as cache_creation_tokens,
      SUM(cache_read_tokens) as cache_read_tokens,
      SUM(cost_usd) as cost_usd,
      COUNT(*) as entry_count
    FROM usage_entries
    WHERE session_id = ?
    GROUP BY model
    ORDER BY cost_usd DESC
  `,
    )
    .all(sessionId) as Array<{
    model: string;
    input_tokens: number;
    output_tokens: number;
    cache_creation_tokens: number;
    cache_read_tokens: number;
    cost_usd: number;
    entry_count: number;
  }>;

  return rows.map((r) => ({
    model: r.model,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    cacheCreationTokens: r.cache_creation_tokens,
    cacheReadTokens: r.cache_read_tokens,
    costUsd: r.cost_usd,
    entryCount: r.entry_count,
  }));
}

/**
 * Get per-model breakdown for a single project.
 */
export function getProjectDetail(projectAlias: string, range: TimeRange): SessionDetailRow[] {
  const raw = getRawDb();
  const where = whereClause(range);
  const whereStr = where.sql
    ? `${where.sql} AND project_alias = ?`
    : 'WHERE project_alias = ?';
  const params = [...where.params, projectAlias];

  const rows = raw
    .prepare(
      `
    SELECT
      model,
      SUM(input_tokens) as input_tokens,
      SUM(output_tokens) as output_tokens,
      SUM(cache_creation_tokens) as cache_creation_tokens,
      SUM(cache_read_tokens) as cache_read_tokens,
      SUM(cost_usd) as cost_usd,
      COUNT(*) as entry_count
    FROM usage_entries
    ${whereStr}
    GROUP BY model
    ORDER BY cost_usd DESC
  `,
    )
    .all(...params) as Array<{
    model: string;
    input_tokens: number;
    output_tokens: number;
    cache_creation_tokens: number;
    cache_read_tokens: number;
    cost_usd: number;
    entry_count: number;
  }>;

  return rows.map((r) => ({
    model: r.model,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    cacheCreationTokens: r.cache_creation_tokens,
    cacheReadTokens: r.cache_read_tokens,
    costUsd: r.cost_usd,
    entryCount: r.entry_count,
  }));
}

/**
 * Get cost breakdown by token type for a time range.
 */
export function getCostBreakdown(range: TimeRange): CostBreakdown {
  const raw = getRawDb();
  const where = whereClause(range);

  const row = raw
    .prepare(
      `
    SELECT
      COALESCE(SUM(input_tokens * 1.0), 0) as total_input,
      COALESCE(SUM(output_tokens * 1.0), 0) as total_output,
      COALESCE(SUM(cache_creation_tokens * 1.0), 0) as total_cache_write,
      COALESCE(SUM(cache_read_tokens * 1.0), 0) as total_cache_read,
      COALESCE(SUM(cost_usd), 0) as total_cost
    FROM usage_entries
    ${where.sql}
  `,
    )
    .get(...where.params) as {
    total_input: number;
    total_output: number;
    total_cache_write: number;
    total_cache_read: number;
    total_cost: number;
  };

  // Approximate cost split using average pricing ratios
  // The exact split depends on model mix, but this gives a reasonable breakdown
  const totalTokens = row.total_input + row.total_output + row.total_cache_write + row.total_cache_read;
  if (totalTokens === 0) {
    return { inputCost: 0, outputCost: 0, cacheWriteCost: 0, cacheReadCost: 0, totalCost: 0 };
  }

  // Use actual per-model cost calculation for accurate breakdown
  const modelRows = raw
    .prepare(
      `
    SELECT
      model,
      SUM(input_tokens) as input_tokens,
      SUM(output_tokens) as output_tokens,
      SUM(cache_creation_tokens) as cache_creation_tokens,
      SUM(cache_read_tokens) as cache_read_tokens
    FROM usage_entries
    ${where.sql}
    GROUP BY model
  `,
    )
    .all(...where.params) as Array<{
    model: string;
    input_tokens: number;
    output_tokens: number;
    cache_creation_tokens: number;
    cache_read_tokens: number;
  }>;

  // Use shared pricing to calculate per-type costs
  let inputCost = 0;
  let outputCost = 0;
  let cacheWriteCost = 0;
  let cacheReadCost = 0;

  // Dynamic import would be cleaner but we inline the pricing lookup for simplicity
  // Pricing rates (per million tokens) — matches shared/src/pricing.ts FALLBACK_PRICING
  const rates: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
    'claude-opus-4-6': { input: 5, output: 25, cacheWrite: 10, cacheRead: 0.5 },
    'claude-opus-4-5': { input: 5, output: 25, cacheWrite: 10, cacheRead: 0.5 },
    'claude-sonnet-4-6': { input: 3, output: 15, cacheWrite: 6, cacheRead: 0.3 },
    'claude-sonnet-4-5': { input: 3, output: 15, cacheWrite: 6, cacheRead: 0.3 },
    'claude-haiku-4-5': { input: 1, output: 5, cacheWrite: 2, cacheRead: 0.1 },
  };
  const defaultRate = rates['claude-sonnet-4-6']!;

  for (const m of modelRows) {
    const r = Object.entries(rates).find(([k]) => m.model.startsWith(k))?.[1] ?? defaultRate;
    inputCost += (m.input_tokens / 1_000_000) * r.input;
    outputCost += (m.output_tokens / 1_000_000) * r.output;
    cacheWriteCost += (m.cache_creation_tokens / 1_000_000) * r.cacheWrite;
    cacheReadCost += (m.cache_read_tokens / 1_000_000) * r.cacheRead;
  }

  return {
    inputCost,
    outputCost,
    cacheWriteCost,
    cacheReadCost,
    totalCost: inputCost + outputCost + cacheWriteCost + cacheReadCost,
  };
}

/**
 * Get session count for a time range (for pagination).
 */
export function getSessionCount(range: TimeRange): number {
  const raw = getRawDb();
  const where = whereClause(range);

  const row = raw
    .prepare(
      `SELECT COUNT(DISTINCT session_id) as count FROM usage_entries ${where.sql}`,
    )
    .get(...where.params) as { count: number };

  return row.count;
}

/**
 * Get total entry count.
 */
export function getEntryCount(): number {
  const raw = getRawDb();
  const row = raw.prepare('SELECT COUNT(*) as count FROM usage_entries').get() as {
    count: number;
  };
  return row.count;
}

/**
 * Get the timestamp of the most recent entry.
 */
export function getLastEntryTimestamp(): string | null {
  const raw = getRawDb();
  const row = raw.prepare('SELECT MAX(timestamp) as ts FROM usage_entries').get() as {
    ts: string | null;
  };
  return row.ts;
}
