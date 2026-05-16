import { test as setup, expect, request } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:8081';
const ADMIN_EMAIL = process.env['E2E_ADMIN_EMAIL'] ?? 'admin@test.local';
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? 'test1234';
const AUTH_STATE = path.join(__dirname, '..', 'fixtures', 'auth-state.json');

const TEST_DEVS = [
  { email: 'alice@test.local', displayName: 'Alice Chen', password: 'test1234', developerId: 'dev-e2e-alice' },
  { email: 'bob@test.local',   displayName: 'Bob Smith',  password: 'test1234', developerId: 'dev-e2e-bob' },
];

function makeEntries(developerId: string, model: string, count: number, daysAgo: number) {
  return Array.from({ length: count }, (_, i) => ({
    sessionId:  `sess-${developerId.slice(-6)}-d${daysAgo}-${i}`,
    messageId:  `msg-${developerId.slice(-6)}-d${daysAgo}-${i}`,
    requestId:  `req-${developerId.slice(-6)}-d${daysAgo}-${i}`,
    timestamp:  new Date(Date.now() - daysAgo * 86_400_000 - i * 60_000).toISOString(),
    model,
    usage: { inputTokens: 1200, outputTokens: 800, cacheCreationTokens: 200, cacheReadTokens: 400 },
    serviceTier: 'standard',
    developerId,
    projectAlias: `proj-${daysAgo % 3}`,
    costUsd: 0.042,
  }));
}

setup('authenticate and seed test data', async ({ page, browser }) => {
  // 1. Wait for server
  const ctx = await request.newContext({ baseURL: BASE });
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const r = await ctx.get('/api/v1/health');
      if (r.ok()) break;
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 1000));
  }

  // 2. Log in as admin
  const loginRes = await ctx.post('/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(loginRes.ok(), `Admin login failed: ${await loginRes.text()}`).toBeTruthy();
  const loginBody = await loginRes.json() as {
    token: string;
    user: { id: string; developerId: string; role: string; email: string; displayName: string };
  };
  const adminToken = loginBody.token;
  const adminUser = loginBody.user;

  const authed = await request.newContext({
    baseURL: BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${adminToken}` },
  });

  // 3. Create test developers and their API keys
  const devKeys: Record<string, string> = {}; // developerId -> apiKey

  for (const dev of TEST_DEVS) {
    // Create or skip if already exists (409)
    let userId: string | null = null;
    const createRes = await authed.post('/api/v1/admin/developers', { data: dev });
    if (createRes.ok()) {
      const body = await createRes.json() as { id: string; developerId: string };
      userId = body.id;
    } else if (createRes.status() === 409) {
      // Fetch existing user id from the list
      const listRes = await authed.get('/api/v1/admin/developers');
      if (listRes.ok()) {
        const users = await listRes.json() as Array<{ id: string; email: string }>;
        userId = users.find(u => u.email === dev.email)?.id ?? null;
      }
    }

    if (!userId) continue;

    // Create API key using userId
    const keyRes = await authed.post('/api/v1/admin/api-keys', {
      data: { userId, label: `e2e-${dev.email}` },
    });
    if (keyRes.ok()) {
      const keyBody = await keyRes.json() as { key: string; developerId: string };
      devKeys[keyBody.developerId] = keyBody.key;
    }
  }

  // 4. Create an API key for admin too
  const adminKeyRes = await authed.post('/api/v1/admin/api-keys', {
    data: { userId: adminUser.id, label: 'e2e-admin' },
  });
  if (adminKeyRes.ok()) {
    const keyBody = await adminKeyRes.json() as { key: string; developerId: string };
    devKeys[keyBody.developerId] = keyBody.key;
  }

  // 5. Ingest usage data for all developers
  const models = ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'];
  for (const [developerId, apiKey] of Object.entries(devKeys)) {
    const devCtx = await request.newContext({
      baseURL: BASE,
      extraHTTPHeaders: { 'X-API-Key': apiKey },
    });
    for (let day = 0; day < 7; day++) {
      const model = models[day % models.length];
      const entryCount = developerId === adminUser.developerId ? 8 : 5;
      await devCtx.post('/api/v1/ingest', {
        data: {
          collectorVersion: '1.0.0',
          developerId,
          timestamp: new Date().toISOString(),
          entries: makeEntries(developerId, model, entryCount, day),
        },
      });
    }
    await devCtx.dispose();
  }

  // 6. Write auth state directly — most reliable way to pre-seed localStorage
  const storageState = {
    cookies: [],
    origins: [{
      origin: BASE,
      localStorage: [
        { name: 'chub_token', value: adminToken },
        { name: 'chub_user', value: JSON.stringify(adminUser) },
      ],
    }],
  };
  fs.mkdirSync(path.dirname(AUTH_STATE), { recursive: true });
  fs.writeFileSync(AUTH_STATE, JSON.stringify(storageState, null, 2));

  await ctx.dispose();
  await authed.dispose();

  const totalDevs = Object.keys(devKeys).length;
  console.log(`\n  Seeded ${totalDevs} developers (including admin) with 7 days of usage data`);
  console.log(`  Auth state saved → ${AUTH_STATE}\n`);
});
