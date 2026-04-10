import { describe, it, expect } from 'vitest';
import { hashProjectDir, getProjectAlias } from '../privacy.js';
import type { AliasMap } from '@claude-usage-hub/shared';

describe('hashProjectDir', () => {
  it('produces deterministic 12-char hex hash', () => {
    const hash = hashProjectDir('my-project', 'salt123');
    expect(hash.length).toBe(12);
    expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
    // Same input = same output
    expect(hashProjectDir('my-project', 'salt123')).toBe(hash);
  });

  it('produces different hashes for different inputs', () => {
    const hash1 = hashProjectDir('project-a', 'salt');
    const hash2 = hashProjectDir('project-b', 'salt');
    expect(hash1).not.toBe(hash2);
  });

  it('produces different hashes for different salts', () => {
    const hash1 = hashProjectDir('project', 'salt1');
    const hash2 = hashProjectDir('project', 'salt2');
    expect(hash1).not.toBe(hash2);
  });
});

describe('getProjectAlias', () => {
  it('returns a hash and stores reverse mapping', () => {
    const aliases: AliasMap = {};
    const alias = getProjectAlias('my-project-dir', 'test-salt', aliases);

    expect(alias.length).toBe(12);
    expect(aliases[alias]).toBe('my-project-dir');
  });

  it('returns same alias for same input', () => {
    const aliases: AliasMap = {};
    const first = getProjectAlias('dir', 'salt', aliases);
    const second = getProjectAlias('dir', 'salt', aliases);
    expect(first).toBe(second);
  });
});
