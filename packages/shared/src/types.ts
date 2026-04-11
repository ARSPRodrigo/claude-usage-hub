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

/** User roles in the system (hierarchy: primary_owner > owner > developer). */
export type UserRole = 'primary_owner' | 'owner' | 'developer';

/** Roles that have admin-level access (can view all data, manage team). */
export const ADMIN_ROLES: readonly UserRole[] = ['primary_owner', 'owner'] as const;

/** Check if a role has admin-level access. */
export function isAdminRole(role: string): boolean {
  return role === 'primary_owner' || role === 'owner';
}

// ---------------------------------------------------------------------------
// API response types (used by server + dashboard)
// ---------------------------------------------------------------------------

/** Time range options for dashboard queries. */
export type TimeRange = '5h' | '24h' | '7d' | '30d' | 'all';

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

/** Per-model breakdown within a single session. */
export interface SessionDetailRow {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  entryCount: number;
}

/** Cost breakdown by token type. */
export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  cacheWriteCost: number;
  cacheReadCost: number;
  totalCost: number;
}

/** Health check response. */
export interface HealthResponse {
  status: 'ok';
  mode: AppMode;
  entryCount: number;
  version: string;
}

// ---------------------------------------------------------------------------
// Auth types (team mode)
// ---------------------------------------------------------------------------

/** A registered user (admin or developer). */
export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  developerId: string;
  createdAt: string;
  updatedAt: string;
}

/** API key record (hash stored, never the raw key). */
export interface ApiKey {
  id: string;
  userId: string;
  keyPrefix: string;
  keyHash: string;
  label: string;
  developerId: string;
  createdAt: string;
  revokedAt: string | null;
}

/** JWT payload stored in the token. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  developerId: string;
  iat: number;
  exp: number;
}

/** Login request body. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Login response body. */
export interface LoginResponse {
  token: string;
  user: Omit<User, 'createdAt' | 'updatedAt'>;
}

/** Create API key request. */
export interface CreateApiKeyRequest {
  userId: string;
  label: string;
}

/** Create API key response (includes the raw key, shown once). */
export interface CreateApiKeyResponse {
  id: string;
  key: string;
  keyPrefix: string;
  label: string;
  developerId: string;
}

/** Create developer request. */
export interface CreateDeveloperRequest {
  email: string;
  password: string;
  displayName: string;
  developerId: string;
}

/** Auth context set by middleware on each request. */
export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
  developerId: string;
  apiKeyId?: string;
}
