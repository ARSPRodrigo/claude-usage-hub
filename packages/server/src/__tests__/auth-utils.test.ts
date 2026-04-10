import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateApiKey,
  hashApiKey,
} from '../services/auth-utils.js';

describe('auth-utils', () => {
  describe('hashPassword / verifyPassword', () => {
    it('hashes and verifies a correct password', () => {
      const hash = hashPassword('mySecret123');
      expect(hash).toContain(':');
      expect(verifyPassword('mySecret123', hash)).toBe(true);
    });

    it('rejects an incorrect password', () => {
      const hash = hashPassword('mySecret123');
      expect(verifyPassword('wrongPassword', hash)).toBe(false);
    });

    it('produces different hashes for the same password (random salt)', () => {
      const hash1 = hashPassword('same');
      const hash2 = hashPassword('same');
      expect(hash1).not.toBe(hash2);
      // Both should still verify
      expect(verifyPassword('same', hash1)).toBe(true);
      expect(verifyPassword('same', hash2)).toBe(true);
    });

    it('returns false for malformed stored hash', () => {
      expect(verifyPassword('anything', 'no-colon')).toBe(false);
      expect(verifyPassword('anything', '')).toBe(false);
    });
  });

  describe('generateApiKey', () => {
    it('produces a key with chub_ prefix', () => {
      const { key, keyHash, keyPrefix } = generateApiKey();
      expect(key).toMatch(/^chub_[a-f0-9]{64}$/);
      expect(keyPrefix).toBe(key.slice(0, 12));
      expect(keyHash).toHaveLength(64); // SHA-256 hex
    });

    it('produces unique keys each time', () => {
      const k1 = generateApiKey();
      const k2 = generateApiKey();
      expect(k1.key).not.toBe(k2.key);
      expect(k1.keyHash).not.toBe(k2.keyHash);
    });
  });

  describe('hashApiKey', () => {
    it('is deterministic', () => {
      const key = 'chub_abc123';
      expect(hashApiKey(key)).toBe(hashApiKey(key));
    });

    it('produces different hashes for different keys', () => {
      expect(hashApiKey('chub_aaa')).not.toBe(hashApiKey('chub_bbb'));
    });
  });
});
