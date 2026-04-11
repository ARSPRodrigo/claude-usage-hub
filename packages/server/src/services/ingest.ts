import { ingestPayloadSchema } from '@claude-usage-hub/shared';
import type { EnrichedEntry, IngestPayload } from '@claude-usage-hub/shared';
import { insertEntries } from '../db/repository.js';

/**
 * Ingest an IngestPayload (team mode — from HTTP POST).
 * Validates the payload, then inserts entries.
 */
export function ingestPayload(payload: unknown, apiKeyId?: string): { inserted: number; error?: string } {
  const parsed = ingestPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { inserted: 0, error: parsed.error.message };
  }

  const inserted = insertEntries(parsed.data.entries, apiKeyId);
  return { inserted };
}

/**
 * Ingest entries directly (local mode — no HTTP, no validation needed).
 */
export function ingestDirect(entries: EnrichedEntry[]): { inserted: number } {
  const inserted = insertEntries(entries);
  return { inserted };
}
