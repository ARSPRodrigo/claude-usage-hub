import { existsSync, readFileSync } from 'node:fs';
import { DEFAULTS, statsCacheSchema } from '@claude-usage-hub/shared';
import type { StatsSummary } from '@claude-usage-hub/shared';
import { expandHome } from './config.js';

/**
 * Read and parse ~/.claude/stats-cache.json.
 *
 * Returns a summary suitable for inclusion in the ingest payload,
 * or null if the file doesn't exist or is invalid.
 */
export function readStatsSummary(): StatsSummary | null {
  const statsPath = expandHome(DEFAULTS.CLAUDE_STATS_PATH);

  if (!existsSync(statsPath)) return null;

  try {
    const raw = JSON.parse(readFileSync(statsPath, 'utf-8'));
    const parsed = statsCacheSchema.safeParse(raw);

    if (!parsed.success) return null;

    return {
      totalSessions: parsed.data.totalSessions,
      totalMessages: parsed.data.totalMessages,
      dailyActivity: parsed.data.dailyActivity,
      dailyModelTokens: parsed.data.dailyModelTokens,
    };
  } catch {
    return null;
  }
}
