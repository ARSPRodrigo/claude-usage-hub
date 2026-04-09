import { createReadStream, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { assistantEntrySchema } from '@claude-usage-hub/shared';
import type { UsageEntry } from '@claude-usage-hub/shared';

export interface ParseResult {
  entries: UsageEntry[];
  newOffset: number;
}

/**
 * Stream-parse a JSONL file starting from a byte offset.
 *
 * Only extracts type=assistant entries with valid usage data.
 * Skips malformed lines and non-assistant entries silently.
 */
export async function parseJsonlFile(
  filePath: string,
  startOffset: number = 0,
): Promise<ParseResult> {
  const entries: UsageEntry[] = [];

  // Check file exists and get size
  let fileSize: number;
  try {
    fileSize = statSync(filePath).size;
  } catch {
    return { entries: [], newOffset: 0 };
  }

  // If file was truncated (smaller than cursor), reset
  const offset = startOffset > fileSize ? 0 : startOffset;

  // Nothing new to read
  if (offset >= fileSize) {
    return { entries: [], newOffset: offset };
  }

  const stream = createReadStream(filePath, {
    encoding: 'utf-8',
    start: offset,
  });

  const rl = createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const raw = JSON.parse(trimmed);

      // Quick type check before full validation
      if (raw.type !== 'assistant') continue;

      const parsed = assistantEntrySchema.safeParse(raw);
      if (!parsed.success) continue;

      const entry = parsed.data;
      entries.push({
        sessionId: entry.sessionId,
        messageId: entry.message.id,
        requestId: entry.requestId,
        timestamp: entry.timestamp,
        model: entry.message.model,
        usage: {
          inputTokens: entry.message.usage.input_tokens,
          outputTokens: entry.message.usage.output_tokens,
          cacheCreationTokens: entry.message.usage.cache_creation_input_tokens,
          cacheReadTokens: entry.message.usage.cache_read_input_tokens,
        },
        serviceTier: entry.message.usage.service_tier,
      });
    } catch {
      // Malformed JSON line — skip silently
    }
  }

  return { entries, newOffset: fileSize };
}
