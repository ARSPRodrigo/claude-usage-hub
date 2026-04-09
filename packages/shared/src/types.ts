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
