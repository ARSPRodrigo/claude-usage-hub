import { describe, it, expect } from 'vitest';
import { dedup, createDedupKey } from '../dedup.js';
import type { UsageEntry } from '@claude-usage-hub/shared';

function makeEntry(messageId: string, requestId: string, outputTokens: number): UsageEntry {
  return {
    sessionId: 's1',
    messageId,
    requestId,
    timestamp: '2026-04-01T10:00:00Z',
    model: 'claude-opus-4-6',
    usage: { inputTokens: 3, outputTokens, cacheCreationTokens: 0, cacheReadTokens: 0 },
    serviceTier: 'standard',
  };
}

describe('createDedupKey', () => {
  it('creates composite key from messageId and requestId', () => {
    const entry = makeEntry('msg_1', 'req_1', 100);
    expect(createDedupKey(entry)).toBe('msg_1:req_1');
  });
});

describe('dedup', () => {
  it('keeps only the last entry per messageId:requestId', () => {
    const entries = [
      makeEntry('msg_1', 'req_1', 0),    // streaming: 0 tokens
      makeEntry('msg_1', 'req_1', 50),   // streaming: 50 tokens
      makeEntry('msg_1', 'req_1', 150),  // final: 150 tokens
    ];
    const seen = new Set<string>();
    const result = dedup(entries, seen);

    expect(result.length).toBe(1);
    expect(result[0]!.usage.outputTokens).toBe(150); // kept the last one
  });

  it('keeps entries with different keys', () => {
    const entries = [
      makeEntry('msg_1', 'req_1', 100),
      makeEntry('msg_2', 'req_2', 200),
    ];
    const seen = new Set<string>();
    const result = dedup(entries, seen);

    expect(result.length).toBe(2);
  });

  it('filters against previously seen hashes', () => {
    const seen = new Set(['msg_1:req_1']);
    const entries = [
      makeEntry('msg_1', 'req_1', 100),  // already seen
      makeEntry('msg_2', 'req_2', 200),  // new
    ];
    const result = dedup(entries, seen);

    expect(result.length).toBe(1);
    expect(result[0]!.messageId).toBe('msg_2');
  });

  it('updates seen set with new entries', () => {
    const seen = new Set<string>();
    dedup([makeEntry('msg_1', 'req_1', 100)], seen);

    expect(seen.has('msg_1:req_1')).toBe(true);
  });
});
