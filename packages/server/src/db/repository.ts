import { sql } from 'drizzle-orm';
import { TIME_RANGE_HOURS } from '@claude-usage-hub/shared';
import type {
  DashboardStats,
  TimeseriesPoint,
  CostTrendPoint,
  ModelMixEntry,
  SessionRow,
  ProjectRow,
  EnrichedEntry,
  TimeRange,
} from '@claude-usage-hub/shared';
import { getRawDb, getDb } from './connection.js';
import { usageEntries } from './schema.js';

/**
 * Get the ISO timestamp for "now minus N hours".
 */
function cutoffTime(range: TimeRange): string {
  const hours = TIME_RANGE_HOURS[range] ?? 24;
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  return cutoff.toISOString();
}

/**
 * Get the time bucket SQL expression based on range.
 * 5h → 15min, 24h → 1h, 7d → 6h, 30d → 1d
 */
function bucketExpression(range: TimeRange): string {
  switch (range) {
    case '5h':
      // Floor to 15-minute intervals
      return `strftime('%Y-%m-%dT%H:', timestamp) || printf('%02d', (cast(strftime('%M', timestamp) as integer) / 15) * 15) || ':00Z'`;
    case '24h':
      // Floor to hour
      return `strftime('%Y-%m-%dT%H:00:00Z', timestamp)`;
    case '7d':
      // Floor to 6-hour intervals
      return `strftime('%Y-%m-%dT', timestamp) || printf('%02d', (cast(strftime('%H', timestamp) as integer) / 6) * 6) || ':00:00Z'`;
    case '30d':
      // Floor to day
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
  const cutoff = cutoffTime(range);

  const row = raw
    .prepare(
      `
    SELECT
      COALESCE(SUM(input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens), 0) as tokens,
      COALESCE(SUM(cost_usd), 0) as cost,
      COUNT(DISTINCT session_id) as sessions
    FROM usage_entries
    WHERE timestamp >= ?
  `,
    )
    .get(cutoff) as { tokens: number; cost: number; sessions: number };

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
  const cutoff = cutoffTime(range);
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
    WHERE timestamp >= ?
    GROUP BY bucket, model
    ORDER BY bucket ASC, model ASC
  `,
    )
    .all(cutoff) as Array<{
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
  const cutoff = cutoffTime(range);

  const rows = raw
    .prepare(
      `
    SELECT
      date(timestamp) as date,
      SUM(cost_usd) as cost_usd
    FROM usage_entries
    WHERE timestamp >= ?
    GROUP BY date(timestamp)
    ORDER BY date ASC
  `,
    )
    .all(cutoff) as Array<{ date: string; cost_usd: number }>;

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
  const cutoff = cutoffTime(range);

  const rows = raw
    .prepare(
      `
    SELECT
      model,
      SUM(input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens) as total_tokens,
      SUM(cost_usd) as cost_usd
    FROM usage_entries
    WHERE timestamp >= ?
    GROUP BY model
    ORDER BY total_tokens DESC
  `,
    )
    .all(cutoff) as Array<{ model: string; total_tokens: number; cost_usd: number }>;

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
  const cutoff = cutoffTime(range);

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
    WHERE timestamp >= ?
    GROUP BY session_id
    ORDER BY MAX(timestamp) DESC
    LIMIT ? OFFSET ?
  `,
    )
    .all(cutoff, limit, offset) as Array<{
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
  const cutoff = cutoffTime(range);

  const rows = raw
    .prepare(
      `
    SELECT
      project_alias,
      COUNT(DISTINCT session_id) as session_count,
      SUM(input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens) as total_tokens,
      SUM(cost_usd) as cost_usd
    FROM usage_entries
    WHERE timestamp >= ?
    GROUP BY project_alias
    ORDER BY total_tokens DESC
  `,
    )
    .all(cutoff) as Array<{
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
 * Get total entry count.
 */
export function getEntryCount(): number {
  const raw = getRawDb();
  const row = raw.prepare('SELECT COUNT(*) as count FROM usage_entries').get() as {
    count: number;
  };
  return row.count;
}
