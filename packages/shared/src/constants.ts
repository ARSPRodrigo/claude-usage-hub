/** Known Claude model identifiers. */
export const MODELS = {
  OPUS: 'claude-opus-4-6',
  SONNET: 'claude-sonnet-4-6',
  HAIKU: 'claude-haiku-4-5-20251001',
} as const;

/** All known model identifiers for validation. */
export const KNOWN_MODELS = [MODELS.OPUS, MODELS.SONNET, MODELS.HAIKU] as const;

/** Default collector configuration values. */
export const DEFAULTS = {
  INTERVAL_MINUTES: 30,
  CLAUDE_DATA_PATH: '~/.claude/projects',
  CLAUDE_STATS_PATH: '~/.claude/stats-cache.json',
  COLLECTOR_CONFIG_DIR: '~/.claude-usage-hub',
  COLLECTOR_CONFIG_FILE: 'config.json',
  CURSORS_FILE: 'cursors.json',
  ALIASES_FILE: 'aliases.json',
  SEEN_HASHES_FILE: 'seen-hashes.json',
  OUTBOX_DIR: 'outbox',
} as const;

/** Current collector version. */
export const COLLECTOR_VERSION = '0.1.0';

/** Session duration in hours (Claude's billing window). */
export const SESSION_DURATION_HOURS = 5;

/** Server default configuration values. */
export const SERVER_DEFAULTS = {
  PORT: 8080,
  DB_PATH: '~/.claude-usage-hub/usage.db',
  RETENTION_DAYS: 90,
  MODE: 'local',
} as const;

/** Hours per time range for query filtering. */
export const TIME_RANGE_HOURS: Record<string, number> = {
  '5h': 5,
  '24h': 24,
  '7d': 168,
  '30d': 720,
};

/** Plan types and their approximate token limits per 5-hour window. */
export const PLAN_LIMITS: Record<string, { tokenLimit: number; displayName: string }> = {
  pro: { tokenLimit: 19_000, displayName: 'Pro' },
  max5: { tokenLimit: 88_000, displayName: 'Max 5x' },
  max20: { tokenLimit: 220_000, displayName: 'Max 20x' },
  team_standard: { tokenLimit: 44_000, displayName: 'Team Standard' },
  team_premium: { tokenLimit: 275_000, displayName: 'Team Premium' },
  enterprise: { tokenLimit: 500_000, displayName: 'Enterprise' },
} as const;
