import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { API_KEY_PREFIX } from '@claude-usage-hub/shared';

const SCRYPT_KEYLEN = 64;

/**
 * Hash a password using scrypt with a random salt.
 * Returns `salt:derivedKey` in hex.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

/**
 * Verify a password against a stored hash.
 * Uses timingSafeEqual to prevent timing attacks.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [saltHex, keyHex] = storedHash.split(':');
  if (!saltHex || !keyHex) return false;

  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(keyHex, 'hex');
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN);

  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/**
 * Generate a new API key with prefix `chub_`.
 * Returns the raw key (shown once), its SHA-256 hash (stored), and a prefix (for display).
 */
export function generateApiKey(): { key: string; keyHash: string; keyPrefix: string } {
  const bytes = randomBytes(32);
  const key = `${API_KEY_PREFIX}${bytes.toString('hex')}`;
  const keyHash = hashApiKey(key);
  const keyPrefix = key.slice(0, 12);
  return { key, keyHash, keyPrefix };
}

/**
 * Compute SHA-256 hash of an API key string (for database lookup).
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}
