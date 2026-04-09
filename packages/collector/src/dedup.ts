import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { DEFAULTS } from '@claude-usage-hub/shared';
import type { UsageEntry } from '@claude-usage-hub/shared';
import { ensureConfigDir, getConfigPath } from './config.js';

const HASHES_PATH = () => getConfigPath(DEFAULTS.SEEN_HASHES_FILE);

/** Max age for persisted hashes (24 hours in ms). */
const MAX_HASH_AGE_MS = 24 * 60 * 60 * 1000;

interface PersistedHashes {
  updatedAt: string;
  hashes: string[];
}

/** Create a dedup key from message ID and request ID. */
export function createDedupKey(entry: UsageEntry): string {
  return `${entry.messageId}:${entry.requestId}`;
}

/** Load persisted hashes from disk. Discards if older than 24h. */
export function loadSeenHashes(): Set<string> {
  const path = HASHES_PATH();
  if (!existsSync(path)) return new Set();

  try {
    const raw: PersistedHashes = JSON.parse(readFileSync(path, 'utf-8'));
    const age = Date.now() - new Date(raw.updatedAt).getTime();

    // Discard stale hashes
    if (age > MAX_HASH_AGE_MS) return new Set();

    return new Set(raw.hashes);
  } catch {
    return new Set();
  }
}

/** Save seen hashes to disk. */
export function saveSeenHashes(hashes: Set<string>): void {
  ensureConfigDir();
  const data: PersistedHashes = {
    updatedAt: new Date().toISOString(),
    hashes: Array.from(hashes),
  };
  writeFileSync(HASHES_PATH(), JSON.stringify(data), 'utf-8');
}

/**
 * Deduplicate a list of entries.
 *
 * Claude Code writes streaming entries: same messageId:requestId but
 * incrementing token counts as the response streams in. We keep only
 * the LAST entry per key (the one with the final, complete token counts).
 *
 * Also filters against previously seen hashes to avoid re-sending
 * entries from prior collection cycles.
 */
export function dedup(
  entries: UsageEntry[],
  seenHashes: Set<string>,
): UsageEntry[] {
  // First pass: keep only the last entry per messageId:requestId
  const latestByKey = new Map<string, UsageEntry>();
  for (const entry of entries) {
    const key = createDedupKey(entry);
    latestByKey.set(key, entry); // later entries overwrite earlier ones
  }

  // Second pass: filter against previously seen hashes
  const result: UsageEntry[] = [];
  for (const [key, entry] of latestByKey) {
    if (!seenHashes.has(key)) {
      seenHashes.add(key);
      result.push(entry);
    }
  }

  return result;
}
