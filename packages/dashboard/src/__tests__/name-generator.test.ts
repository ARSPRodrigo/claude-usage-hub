import { describe, it, expect } from 'vitest';
import { generateName, getDisplayName } from '../lib/name-generator';

describe('generateName', () => {
  it('produces three-word hyphenated name', () => {
    const name = generateName('test-id-123');
    const parts = name.split('-');
    expect(parts.length).toBe(3);
    expect(parts.every((p) => p.length > 0)).toBe(true);
  });

  it('is deterministic — same ID produces same name', () => {
    expect(generateName('abc')).toBe(generateName('abc'));
  });

  it('produces different names for different IDs', () => {
    expect(generateName('id-1')).not.toBe(generateName('id-2'));
  });
});

describe('getDisplayName', () => {
  it('returns cached name on second call', () => {
    const first = getDisplayName('cache-test');
    const second = getDisplayName('cache-test');
    expect(first).toBe(second);
  });
});
