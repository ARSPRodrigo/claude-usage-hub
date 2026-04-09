/**
 * Core types for claude-usage-hub.
 *
 * These types are shared between the collector, server, and dashboard.
 */

/** Token usage metrics from a single Claude API response. */
export interface UsageMetrics {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

/** A single parsed usage entry extracted from a JSONL assistant message. */
export interface UsageEntry {
  sessionId: string;
  messageId: string;
  requestId: string;
  timestamp: string;
  model: string;
  usage: UsageMetrics;
  serviceTier: string;
}

/** Scanner metadata about a discovered JSONL file. */
export interface ScannedFile {
  filePath: string;
  projectDir: string;
  sessionId: string;
  isSubagent: boolean;
  parentSessionId: string | null;
}

/** A usage entry enriched with project and developer context. */
export interface EnrichedEntry extends UsageEntry {
  developerId: string;
  projectAlias: string;
  costUsd: number;
}

/** Payload the collector POSTs to the server. */
export interface IngestPayload {
  collectorVersion: string;
  developerId: string;
  timestamp: string;
  entries: EnrichedEntry[];
  statsSummary?: StatsSummary;
}

/** Summary data extracted from ~/.claude/stats-cache.json. */
export interface StatsSummary {
  totalSessions: number;
  totalMessages: number;
  dailyActivity: DailyActivity[];
  dailyModelTokens: DailyModelTokens[];
}

export interface DailyActivity {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
}

export interface DailyModelTokens {
  date: string;
  tokensByModel: Record<string, number>;
}

/** Model usage stats from stats-cache.json. */
export interface ModelUsageStats {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  costUSD: number;
}

/** Collector configuration stored at ~/.claude-usage-hub/config.json. */
export interface CollectorConfig {
  serverUrl: string;
  apiKey: string;
  developerId: string;
  salt: string;
  intervalMinutes: number;
  claudeDataPath: string;
}

/** Cursor state: byte offsets per file. */
export type CursorState = Record<string, number>;

/** Alias mapping stored locally: hash → original project dir. */
export type AliasMap = Record<string, string>;

/** User roles in the system. */
export type UserRole = 'admin' | 'developer';

// ---------------------------------------------------------------------------
// API response types (used by server + dashboard)
// ---------------------------------------------------------------------------

/** Time range options for dashboard queries. */
export type TimeRange = '5h' | '24h' | '7d' | '30d';

/** App deployment mode. */
export type AppMode = 'local' | 'team';

/** Server configuration. */
export interface ServerConfig {
  mode: AppMode;
  port: number;
  dbPath: string;
  retentionDays: number;
  dashboardDistPath?: string;
}

/** Dashboard overview stats. */
export interface DashboardStats {
  tokensToday: number;
  costToday: number;
  activeSessions: number;
  totalSessions: number;
}

/** A single point in a token usage timeseries. */
export interface TimeseriesPoint {
  bucket: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  costUsd: number;
}

/** A single point in a daily cost trend. */
export interface CostTrendPoint {
  date: string;
  costUsd: number;
}

/** Model usage breakdown entry. */
export interface ModelMixEntry {
  model: string;
  totalTokens: number;
  costUsd: number;
  percentage: number;
}

/** A session summary row. */
export interface SessionRow {
  sessionId: string;
  firstSeen: string;
  lastSeen: string;
  models: string[];
  totalTokens: number;
  costUsd: number;
  projectAlias: string;
}

/** A project summary row. */
export interface ProjectRow {
  projectAlias: string;
  sessionCount: number;
  totalTokens: number;
  costUsd: number;
}

/** Health check response. */
export interface HealthResponse {
  status: 'ok';
  mode: AppMode;
  entryCount: number;
  version: string;
}
