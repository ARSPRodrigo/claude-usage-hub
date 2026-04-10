import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createDb, closeDb } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import { hashPassword } from '../services/auth-utils.js';
import { generateApiKey, hashApiKey } from '../services/auth-utils.js';
import {
  findUserByEmail,
  findUserById,
  createUser,
  listUsers,
  findApiKeyByHash,
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from '../db/auth-repository.js';

describe('auth-repository', () => {
  beforeEach(() => {
    const { raw } = createDb(':memory:');
    runMigrations(raw);
  });

  afterEach(() => {
    closeDb();
  });

  describe('users', () => {
    const makeUser = () => ({
      id: randomUUID(),
      email: `dev${Math.random().toString(36).slice(2, 6)}@test.com`,
      displayName: 'Test Dev',
      role: 'developer',
      developerId: `dev-${randomUUID().slice(0, 8)}`,
      passwordHash: hashPassword('password123'),
    });

    it('creates and finds a user by email', () => {
      const user = makeUser();
      createUser(user);
      const found = findUserByEmail(user.email);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(user.id);
      expect(found!.email).toBe(user.email);
      expect(found!.role).toBe('developer');
    });

    it('creates and finds a user by id', () => {
      const user = makeUser();
      createUser(user);
      const found = findUserById(user.id);
      expect(found).not.toBeNull();
      expect(found!.email).toBe(user.email);
    });

    it('returns null for non-existent user', () => {
      expect(findUserByEmail('nobody@test.com')).toBeNull();
      expect(findUserById('non-existent')).toBeNull();
    });

    it('lists all users without password hashes', () => {
      createUser(makeUser());
      createUser(makeUser());
      const users = listUsers();
      expect(users).toHaveLength(2);
      // password_hash should not be in the result
      expect((users[0] as any).password_hash).toBeUndefined();
    });
  });

  describe('api_keys', () => {
    function setupUserAndKey() {
      const userId = randomUUID();
      createUser({
        id: userId,
        email: `dev@test.com`,
        displayName: 'Test Dev',
        role: 'developer',
        developerId: 'dev-123',
        passwordHash: hashPassword('password123'),
      });

      const { key, keyHash, keyPrefix } = generateApiKey();
      const keyId = randomUUID();
      createApiKey({
        id: keyId,
        userId,
        keyPrefix,
        keyHash,
        label: 'laptop',
        developerId: 'dev-123',
      });

      return { userId, key, keyHash, keyPrefix, keyId };
    }

    it('creates and finds an API key by hash', () => {
      const { key } = setupUserAndKey();
      const hash = hashApiKey(key);
      const found = findApiKeyByHash(hash);
      expect(found).not.toBeNull();
      expect(found!.label).toBe('laptop');
      expect(found!.developer_id).toBe('dev-123');
    });

    it('returns null for unknown key hash', () => {
      expect(findApiKeyByHash('nonexistent')).toBeNull();
    });

    it('lists API keys without key_hash', () => {
      setupUserAndKey();
      const keys = listApiKeys();
      expect(keys).toHaveLength(1);
      expect((keys[0] as any).key_hash).toBeUndefined();
      expect(keys[0].label).toBe('laptop');
    });

    it('revokes an API key', () => {
      const { key, keyId } = setupUserAndKey();
      expect(revokeApiKey(keyId)).toBe(true);

      // Revoked key should not be findable
      const hash = hashApiKey(key);
      expect(findApiKeyByHash(hash)).toBeNull();
    });

    it('returns false when revoking non-existent key', () => {
      expect(revokeApiKey('non-existent')).toBe(false);
    });

    it('returns false when revoking already-revoked key', () => {
      const { keyId } = setupUserAndKey();
      expect(revokeApiKey(keyId)).toBe(true);
      expect(revokeApiKey(keyId)).toBe(false);
    });
  });
});
