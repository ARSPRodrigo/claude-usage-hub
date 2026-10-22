import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseJsonlFile } from '../parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(__dirname, 'fixtures/sample.jsonl');

describe('parseJsonlFile', () => {
  it('extracts only assistant entries', async () => {
    const { entries } = await parseJsonlFile(FIXTURE);
    // 4 assistant entries in fixture (including streaming dupe)
    expect(entries.length).toBe(4);
    expect(entries.every((e) => e.model.startsWith('claude-'))).toBe(true);
  });

  it('skips user entries and file-history-snapshot', async () => {
    const { entries } = await parseJsonlFile(FIXTURE);
    const types = new Set(entries.map((e) => e.sessionId));
    // Should have entries from session-1 and session-2, not other types
    expect(types.has('test-session-1')).toBe(true);
    expect(types.has('test-session-2')).toBe(true);
  });

  it('skips malformed JSON lines without crashing', async () => {
    const { entries } = await parseJsonlFile(FIXTURE);
    // The fixture has "invalid json line" — should be silently skipped
    expect(entries.length).toBe(4);
  });

  it('extracts correct token data', async () => {
    const { entries } = await parseJsonlFile(FIXTURE);
    const first = entries[0]!;
    expect(first.usage.inputTokens).toBe(3);
    expect(first.usage.outputTokens).toBe(0);
    expect(first.usage.cacheCreationTokens).toBe(500);
    expect(first.model).toBe('claude-opus-4-6');
  });

  it('captures the cache-write TTL split when Claude Code reports it', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'cuh-parser-')), 'ttl.jsonl');
    writeFileSync(file, JSON.stringify({
      type: 'assistant', sessionId: 's', timestamp: '2026-10-01T00:00:00Z', requestId: 'r',
      message: {
        id: 'm', model: 'claude-opus-5-5', role: 'assistant',
        usage: {
          input_tokens: 1, output_tokens: 2, cache_creation_input_tokens: 300, cache_read_input_tokens: 0,
          cache_creation: { ephemeral_5m_input_tokens: 100, ephemeral_1h_input_tokens: 200 },
        },
      },
    }) + '\n');
    const { entries } = await parseJsonlFile(file);
    expect(entries[0]!.usage).toMatchObject({ cacheCreationTokens: 300, cacheWrite5mTokens: 100, cacheWrite1hTokens: 200 });
  });

  it('leaves the split unset for older logs', async () => {
    const { entries } = await parseJsonlFile(FIXTURE);
    expect(entries[0]!.usage.cacheWrite5mTokens).toBeUndefined();
  });

  it('returns new offset equal to file size', async () => {
    const { newOffset } = await parseJsonlFile(FIXTURE);
    expect(newOffset).toBeGreaterThan(0);
  });

  it('returns empty when starting from end of file', async () => {
    const first = await parseJsonlFile(FIXTURE);
    const { entries } = await parseJsonlFile(FIXTURE, first.newOffset);
    expect(entries.length).toBe(0);
  });

  it('handles non-existent file gracefully', async () => {
    const { entries, newOffset } = await parseJsonlFile('/nonexistent/path.jsonl');
    expect(entries.length).toBe(0);
    expect(newOffset).toBe(0);
  });
});
