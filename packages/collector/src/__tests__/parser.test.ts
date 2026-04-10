import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'node:path';
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
