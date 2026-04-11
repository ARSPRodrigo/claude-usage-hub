import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createDb, closeDb } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import { createApp } from '../app.js';
import { setJwtSecret, signJwt } from '../middleware/auth.js';
import { hashPassword, generateApiKey } from '../services/auth-utils.js';
import { createUser, createApiKey } from '../db/auth-repository.js';
import { insertEntries } from '../db/repository.js';
import type { EnrichedEntry } from '@claude-usage-hub/shared';

const JWT_SECRET = 'test-secret-for-auth-tests';

function makeEntry(overrides: Partial<EnrichedEntry> = {}): EnrichedEntry {
  return {
    sessionId: 's1',
    messageId: `msg_${Math.random().toString(36).slice(2, 8)}`,
    requestId: `req_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    model: 'claude-opus-4-6',
    usage: { inputTokens: 100, outputTokens: 200, cacheCreationTokens: 50, cacheReadTokens: 25 },
    serviceTier: 'standard',
    developerId: 'dev-1',
    projectAlias: 'proj-a',
    costUsd: 0.05,
    ...overrides,
  };
}

function setupUsers() {
  const adminId = randomUUID();
  createUser({
    id: adminId,
    email: 'admin@test.com',
    displayName: 'Admin',
    role: 'primary_owner',
    developerId: 'admin-001',
    passwordHash: hashPassword('adminpass123'),
  });

  const devId = randomUUID();
  createUser({
    id: devId,
    email: 'dev@test.com',
    displayName: 'Developer',
    role: 'developer',
    developerId: 'dev-1',
    passwordHash: hashPassword('devpass12345'),
  });

  // Create API key for developer
  const { key, keyHash, keyPrefix } = generateApiKey();
  createApiKey({
    id: randomUUID(),
    userId: devId,
    keyPrefix,
    keyHash,
    label: 'laptop',
    developerId: 'dev-1',
  });

  return { adminId, devId, apiKey: key };
}

describe('auth integration (team mode)', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const { raw } = createDb(':memory:');
    runMigrations(raw);
    setJwtSecret(JWT_SECRET);
    app = createApp('team');
  });

  afterEach(() => {
    closeDb();
  });

  describe('POST /auth/login', () => {
    it('returns JWT on valid credentials', async () => {
      setupUsers();
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@test.com', password: 'adminpass123' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.token).toBeDefined();
      expect(body.user.role).toBe('primary_owner');
    });

    it('rejects wrong password', async () => {
      setupUsers();
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@test.com', password: 'wrongwrong' }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects non-existent email', async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nobody@test.com', password: 'whatever1' }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    it('returns user info with valid JWT', async () => {
      const { adminId } = setupUsers();
      const token = await signJwt({
        id: adminId,
        email: 'admin@test.com',
        role: 'primary_owner',
        developerId: 'admin-001',
      });

      const res = await app.request('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.email).toBe('admin@test.com');
    });

    it('rejects request without token', async () => {
      const res = await app.request('/auth/me');
      expect(res.status).toBe(401);
    });
  });

  describe('API key auth on /api/v1/ingest', () => {
    it('accepts valid API key', async () => {
      const { apiKey } = setupUsers();
      const res = await app.request('/api/v1/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          collectorVersion: '0.1.0',
          developerId: 'dev-1',
          timestamp: new Date().toISOString(),
          entries: [makeEntry()],
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.inserted).toBe(1);
    });

    it('rejects missing API key', async () => {
      const res = await app.request('/api/v1/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectorVersion: '0.1.0',
          developerId: 'dev-1',
          timestamp: new Date().toISOString(),
          entries: [],
        }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects invalid API key', async () => {
      const res = await app.request('/api/v1/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'chub_invalid',
        },
        body: JSON.stringify({
          collectorVersion: '0.1.0',
          developerId: 'dev-1',
          timestamp: new Date().toISOString(),
          entries: [],
        }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects developerId mismatch', async () => {
      const { apiKey } = setupUsers();
      const res = await app.request('/api/v1/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          collectorVersion: '0.1.0',
          developerId: 'someone-else',
          timestamp: new Date().toISOString(),
          entries: [],
        }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe('JWT auth on dashboard routes', () => {
    it('rejects unauthenticated dashboard request', async () => {
      const res = await app.request('/api/v1/dashboard/stats?range=24h');
      expect(res.status).toBe(401);
    });

    it('allows authenticated dashboard request', async () => {
      const { adminId } = setupUsers();
      const token = await signJwt({
        id: adminId,
        email: 'admin@test.com',
        role: 'primary_owner',
        developerId: 'admin-001',
      });

      const res = await app.request('/api/v1/dashboard/stats?range=24h', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
    });
  });

  describe('developer scoping', () => {
    it('developer sees only their own data', async () => {
      const { devId } = setupUsers();

      // Insert entries for two different developers
      insertEntries([
        makeEntry({ developerId: 'dev-1', costUsd: 0.10 }),
        makeEntry({ developerId: 'dev-1', costUsd: 0.20 }),
        makeEntry({ developerId: 'other-dev', costUsd: 0.50 }),
      ]);

      const token = await signJwt({
        id: devId,
        email: 'dev@test.com',
        role: 'developer',
        developerId: 'dev-1',
      });

      const res = await app.request('/api/v1/dashboard/stats?range=all', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      // Should only see dev-1's data (0.10 + 0.20 = 0.30), not other-dev's 0.50
      expect(body.costToday).toBeCloseTo(0.30, 2);
    });

    it('admin sees all data', async () => {
      const { adminId } = setupUsers();

      insertEntries([
        makeEntry({ developerId: 'dev-1', costUsd: 0.10 }),
        makeEntry({ developerId: 'other-dev', costUsd: 0.50 }),
      ]);

      const token = await signJwt({
        id: adminId,
        email: 'admin@test.com',
        role: 'primary_owner',
        developerId: 'admin-001',
      });

      const res = await app.request('/api/v1/dashboard/stats?range=all', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.costToday).toBeCloseTo(0.60, 2);
    });
  });

  describe('admin routes', () => {
    it('admin can create a developer', async () => {
      const { adminId } = setupUsers();
      const token = await signJwt({
        id: adminId,
        email: 'admin@test.com',
        role: 'primary_owner',
        developerId: 'admin-001',
      });

      const res = await app.request('/api/v1/admin/developers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: 'newdev@test.com',
          password: 'newdevpass1',
          displayName: 'New Dev',
          developerId: 'dev-new',
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.email).toBe('newdev@test.com');
      expect(body.role).toBe('developer');
    });

    it('developer cannot access admin routes', async () => {
      const { devId } = setupUsers();
      const token = await signJwt({
        id: devId,
        email: 'dev@test.com',
        role: 'developer',
        developerId: 'dev-1',
      });

      const res = await app.request('/api/v1/admin/developers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(403);
    });

    it('admin can generate and list API keys', async () => {
      const { adminId, devId } = setupUsers();
      const token = await signJwt({
        id: adminId,
        email: 'admin@test.com',
        role: 'primary_owner',
        developerId: 'admin-001',
      });

      // Generate a new key
      const createRes = await app.request('/api/v1/admin/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: devId, label: 'desktop' }),
      });
      expect(createRes.status).toBe(201);
      const createBody = await createRes.json() as any;
      expect(createBody.key).toMatch(/^chub_/);
      expect(createBody.label).toBe('desktop');

      // List keys
      const listRes = await app.request('/api/v1/admin/api-keys', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(listRes.status).toBe(200);
      const keys = await listRes.json() as any;
      // Should have the setup key + the new one
      expect(keys.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('local mode (backward compatible)', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    const { raw } = createDb(':memory:');
    runMigrations(raw);
    app = createApp('local');
  });

  afterEach(() => {
    closeDb();
  });

  it('allows unauthenticated access to all routes', async () => {
    const healthRes = await app.request('/api/v1/health');
    expect(healthRes.status).toBe(200);

    const statsRes = await app.request('/api/v1/dashboard/stats?range=24h');
    expect(statsRes.status).toBe(200);

    const sessionsRes = await app.request('/api/v1/sessions?range=24h');
    expect(sessionsRes.status).toBe(200);

    const projectsRes = await app.request('/api/v1/projects?range=24h');
    expect(projectsRes.status).toBe(200);
  });

  it('allows unauthenticated ingest', async () => {
    const res = await app.request('/api/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collectorVersion: '0.1.0',
        developerId: 'local-user',
        timestamp: new Date().toISOString(),
        entries: [makeEntry({ developerId: 'local-user' })],
      }),
    });
    expect(res.status).toBe(200);
  });
});
