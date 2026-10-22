import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDb, closeDb } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import {
  insertEntries,
  getDashboardStats,
  getModelMix,
  getSessions,
  getProjects,
  getSessionDetail,
  getEntryCount,
  getModelPricingStatus,
} from '../db/repository.js';
import { getRawDb } from '../db/connection.js';
import { startRepricing } from '../services/reprice.js';
import { getPricing } from '@claude-usage-hub/shared';
import type { EnrichedEntry } from '@claude-usage-hub/shared';

// The server prices entries itself from tokens, so a requested cost is
// expressed as output tokens at the model's output rate.
function makeEntry(overrides: Partial<EnrichedEntry> = {}): EnrichedEntry {
  const model = overrides.model ?? 'claude-opus-4-6';
  const usage = overrides.usage ?? (overrides.costUsd !== undefined
    ? { inputTokens: 0, outputTokens: Math.round((overrides.costUsd / getPricing(model).outputPerMillion) * 1_000_000), cacheCreationTokens: 0, cacheReadTokens: 0 }
    : { inputTokens: 100, outputTokens: 200, cacheCreationTokens: 50, cacheReadTokens: 25 });
  return {
    sessionId: 's1',
    messageId: `msg_${Math.random().toString(36).slice(2, 8)}`,
    requestId: `req_${Math.random().toString(36).slice(2, 8)}`,
    // Relative to "now" so the 30d window in tests doesn't drift out of range over time.
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    model: 'claude-opus-4-6',
    serviceTier: 'standard',
    developerId: 'dev-1',
    projectAlias: 'proj-a',
    costUsd: 0.05,
    ...overrides,
    usage,
  };
}

describe('repository', () => {
  beforeEach(() => {
    const { raw } = createDb(':memory:');
    runMigrations(raw);
  });

  afterEach(() => {
    closeDb();
  });

  describe('insertEntries', () => {
    it('inserts entries and returns count', () => {
      const entries = [makeEntry(), makeEntry()];
      const count = insertEntries(entries);
      expect(count).toBe(2);
      expect(getEntryCount()).toBe(2);
    });

    it('is idempotent — ignores duplicates', () => {
      const entry = makeEntry({ messageId: 'dup_msg', requestId: 'dup_req' });
      insertEntries([entry]);
      const count = insertEntries([entry]);
      expect(count).toBe(0);
      expect(getEntryCount()).toBe(1);
    });
  });

  describe('getDashboardStats', () => {
    it('returns zeros when empty', () => {
      const stats = getDashboardStats('30d');
      expect(stats.tokensToday).toBe(0);
      expect(stats.costToday).toBe(0);
      expect(stats.totalSessions).toBe(0);
    });

    it('aggregates tokens and cost', () => {
      insertEntries([makeEntry(), makeEntry()]);
      const stats = getDashboardStats('30d');
      // Opus 4.6 per entry: 100×$5 + 200×$25 + 50×$10 + 25×$0.50 per MTok
      expect(stats.costToday).toBeCloseTo(2 * 0.0060125, 9);
      expect(stats.tokensToday).toBe(750); // (100+200+50+25) * 2
    });
  });

  describe('getModelMix', () => {
    it('groups by model with percentages', () => {
      insertEntries([
        makeEntry({ model: 'claude-opus-4-6' }),
        makeEntry({ model: 'claude-opus-4-6' }),
        makeEntry({ model: 'claude-sonnet-4-6' }),
      ]);
      const mix = getModelMix('30d');
      expect(mix.length).toBe(2);

      const opus = mix.find((m) => m.model === 'claude-opus-4-6');
      expect(opus).toBeDefined();
      expect(opus!.percentage).toBeGreaterThan(60);
    });
  });

  describe('getSessions', () => {
    it('groups entries by session', () => {
      insertEntries([
        makeEntry({ sessionId: 'session-a' }),
        makeEntry({ sessionId: 'session-a' }),
        makeEntry({ sessionId: 'session-b' }),
      ]);
      const sessions = getSessions('30d');
      expect(sessions.length).toBe(2);
    });

    it('respects limit and offset', () => {
      insertEntries([
        makeEntry({ sessionId: 'sa' }),
        makeEntry({ sessionId: 'sb' }),
        makeEntry({ sessionId: 'sc' }),
      ]);
      const page1 = getSessions('30d', 2, 0);
      expect(page1.length).toBe(2);
      const page2 = getSessions('30d', 2, 2);
      expect(page2.length).toBe(1);
    });
  });

  describe('getProjects', () => {
    it('groups entries by project alias', () => {
      insertEntries([
        makeEntry({ projectAlias: 'p1' }),
        makeEntry({ projectAlias: 'p1' }),
        makeEntry({ projectAlias: 'p2' }),
      ]);
      const projects = getProjects('30d');
      expect(projects.length).toBe(2);
      expect(projects[0]!.projectAlias).toBe('p1'); // ordered by tokens desc
    });
  });

  describe('getSessionDetail', () => {
    it('returns per-model breakdown for a session', () => {
      insertEntries([
        makeEntry({ sessionId: 'detail-s', model: 'claude-opus-4-6', costUsd: 1.0 }),
        makeEntry({ sessionId: 'detail-s', model: 'claude-sonnet-4-6', costUsd: 0.5 }),
        makeEntry({ sessionId: 'other-s', model: 'claude-opus-4-6', costUsd: 2.0 }),
      ]);
      const detail = getSessionDetail('detail-s');
      expect(detail.length).toBe(2);
      expect(detail[0]!.model).toBe('claude-opus-4-6'); // ordered by cost desc
      expect(detail[0]!.costUsd).toBeCloseTo(1.0, 1);
    });
  });
});

describe('server-side pricing', () => {
  beforeEach(() => {
    const { raw } = createDb(':memory:');
    runMigrations(raw);
  });
  afterEach(() => closeDb());

  it('ignores the collector cost and prices from tokens', () => {
    insertEntries([makeEntry({
      model: 'claude-opus-5-5',
      usage: { inputTokens: 1_000_000, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 },
      costUsd: 3, // stale collector estimate (old Sonnet fallback)
    })]);
    expect(getDashboardStats('30d').costToday).toBeCloseTo(4, 6);
  });

  it('stores the cache-write TTL split and bills it', () => {
    insertEntries([makeEntry({
      model: 'claude-sonnet-4-6',
      usage: { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 1_000_000, cacheReadTokens: 0, cacheWrite5mTokens: 1_000_000, cacheWrite1hTokens: 0 },
    })]);
    const row = getRawDb().prepare(`SELECT cache_write_5m_tokens AS w5, cost_usd AS c FROM usage_entries`).get() as { w5: number; c: number };
    expect(row.w5).toBe(1_000_000);
    expect(row.c).toBeCloseTo(3.75, 6);
  });

  it('re-prices stored entries once per pricing version', async () => {
    insertEntries([makeEntry({ model: 'claude-fable-5', usage: { inputTokens: 1_000_000, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 } })]);
    const raw = getRawDb();
    raw.prepare(`UPDATE usage_entries SET cost_usd = 3`).run(); // as written by an old collector
    raw.prepare(`DELETE FROM app_meta`).run();

    expect(await startRepricing(raw, () => {})).toBe(1);
    expect((raw.prepare(`SELECT cost_usd AS c FROM usage_entries`).get() as { c: number }).c).toBeCloseTo(10, 6);
    expect(await startRepricing(raw, () => {})).toBe(0); // already applied
  });

  it('reports how each model is priced', () => {
    insertEntries([makeEntry({ model: 'claude-opus-4-6' }), makeEntry({ model: 'claude-opus-9' }), makeEntry({ model: 'other/llm:free' })]);
    const byModel = Object.fromEntries(getModelPricingStatus().models.map((m) => [m.model, m]));
    expect(byModel['claude-opus-4-6']).toMatchObject({ source: 'exact', displayName: 'Opus 4.6' });
    expect(byModel['claude-opus-9']).toMatchObject({ source: 'estimated', basedOn: 'claude-opus-5-5' });
    expect(byModel['other/llm:free']).toMatchObject({ source: 'unpriced', costUsd: 0 });
  });
});
