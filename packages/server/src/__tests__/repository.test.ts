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
} from '../db/repository.js';
import type { EnrichedEntry } from '@claude-usage-hub/shared';

function makeEntry(overrides: Partial<EnrichedEntry> = {}): EnrichedEntry {
  return {
    sessionId: 's1',
    messageId: `msg_${Math.random().toString(36).slice(2, 8)}`,
    requestId: `req_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: '2026-04-01T10:00:00Z',
    model: 'claude-opus-4-6',
    usage: { inputTokens: 100, outputTokens: 200, cacheCreationTokens: 50, cacheReadTokens: 25 },
    serviceTier: 'standard',
    developerId: 'dev-1',
    projectAlias: 'proj-a',
    costUsd: 0.05,
    ...overrides,
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
      insertEntries([
        makeEntry({ costUsd: 1.5 }),
        makeEntry({ costUsd: 2.5 }),
      ]);
      const stats = getDashboardStats('30d');
      expect(stats.costToday).toBeCloseTo(4.0, 1);
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
