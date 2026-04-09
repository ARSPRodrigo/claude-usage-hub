import { calculateCost, COLLECTOR_VERSION } from '@claude-usage-hub/shared';
import type {
  EnrichedEntry,
  IngestPayload,
  ScannedFile,
  StatsSummary,
  UsageEntry,
} from '@claude-usage-hub/shared';
import { getProjectAlias, loadAliases, saveAliases } from './privacy.js';

interface AggregatorInput {
  /** Parsed entries keyed by file path. */
  entriesByFile: Map<string, UsageEntry[]>;
  /** Scanned file metadata keyed by file path. */
  fileMetadata: Map<string, ScannedFile>;
  /** Developer ID from config. */
  developerId: string;
  /** Salt for project aliasing. */
  salt: string;
  /** Optional stats summary. */
  statsSummary?: StatsSummary;
}

/**
 * Aggregate parsed entries into an IngestPayload.
 *
 * - Attaches developerId and projectAlias to each entry
 * - Calculates cost per entry
 * - Rolls subagent entries into parent session ID
 */
export function aggregate(input: AggregatorInput): IngestPayload {
  const { entriesByFile, fileMetadata, developerId, salt, statsSummary } = input;
  const aliases = loadAliases();
  const enriched: EnrichedEntry[] = [];

  for (const [filePath, entries] of entriesByFile) {
    const meta = fileMetadata.get(filePath);
    if (!meta) continue;

    const projectAlias = getProjectAlias(meta.projectDir, salt, aliases);

    for (const entry of entries) {
      // For subagents, use parent session ID so tokens roll up
      const sessionId = meta.isSubagent && meta.parentSessionId
        ? meta.parentSessionId
        : entry.sessionId;

      const costUsd = calculateCost(entry.usage, entry.model);

      enriched.push({
        ...entry,
        sessionId,
        developerId,
        projectAlias,
        costUsd,
      });
    }
  }

  // Sort by timestamp
  enriched.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  saveAliases(aliases);

  return {
    collectorVersion: COLLECTOR_VERSION,
    developerId,
    timestamp: new Date().toISOString(),
    entries: enriched,
    statsSummary,
  };
}
