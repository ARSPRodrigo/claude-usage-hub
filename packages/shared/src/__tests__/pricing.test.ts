import { describe, it, expect } from 'vitest';
import {
  calculateCost,
  getPricing,
  resolvePricing,
  normalizeModelId,
  modelDisplayName,
  modelFamilyName,
  CLAUDE_PRICING,
} from '../pricing.js';
import type { UsageMetrics } from '../types.js';

const MTOK: UsageMetrics = {
  inputTokens: 1_000_000,
  outputTokens: 1_000_000,
  cacheCreationTokens: 1_000_000,
  cacheReadTokens: 1_000_000,
};

describe('normalizeModelId', () => {
  it('strips date snapshots', () => expect(normalizeModelId('claude-haiku-4-5-20251001')).toBe('claude-haiku-4-5'));
  it('strips bedrock prefix and version', () =>
    expect(normalizeModelId('us.anthropic.claude-opus-4-5-20251101-v1:0')).toBe('claude-opus-4-5'));
  it('strips vertex @ snapshots', () => expect(normalizeModelId('claude-opus-4-5@20251101')).toBe('claude-opus-4-5'));
  it('strips context markers', () => expect(normalizeModelId('claude-opus-4-6[1m]')).toBe('claude-opus-4-6'));
});

describe('resolvePricing', () => {
  it('returns exact match for listed models', () => {
    const r = resolvePricing('claude-opus-5-5');
    expect(r.source).toBe('exact');
    expect(r.pricing.inputPerMillion).toBe(4);
    expect(r.pricing.outputPerMillion).toBe(20);
  });

  it('matches dated snapshots exactly', () => {
    const r = resolvePricing('claude-sonnet-4-20250514');
    expect(r.source).toBe('exact');
    expect(r.basedOn).toBe('claude-sonnet-4');
  });

  it('does not confuse versions that share a prefix', () => {
    expect(resolvePricing('claude-opus-4-20250514').pricing.inputPerMillion).toBe(15);
    expect(resolvePricing('claude-opus-4-8').pricing.inputPerMillion).toBe(5);
  });

  it('prices a future version from the newest listed version of its family', () => {
    const r = resolvePricing('claude-opus-6');
    expect(r.source).toBe('estimated');
    expect(r.basedOn).toBe('claude-opus-5-5');
  });

  it('prices an in-between version from the nearest older one', () => {
    expect(resolvePricing('claude-sonnet-4-7').basedOn).toBe('claude-sonnet-4-6');
  });

  it('prices very old models from the oldest listed version', () => {
    expect(resolvePricing('claude-3-7-sonnet-20250219').basedOn).toBe('claude-sonnet-4');
    expect(resolvePricing('claude-3-opus-20240229').basedOn).toBe('claude-opus-4');
  });

  it('handles legacy-style ids', () => {
    expect(resolvePricing('claude-3-5-haiku-20241022')).toMatchObject({ source: 'exact', basedOn: 'claude-haiku-3-5' });
  });

  it('ignores trailing qualifiers', () => {
    expect(resolvePricing('claude-opus-6-0-preview').basedOn).toBe('claude-opus-5-5');
    expect(resolvePricing('claude-mythos-preview').basedOn).toBe('claude-mythos-5-1');
  });

  it('prices an unknown Claude family like the flagship Opus', () => {
    const r = resolvePricing('claude-lyric-1');
    expect(r.source).toBe('estimated');
    expect(r.basedOn).toBe('claude-opus-5-5');
  });

  it('never prices a Claude id at $0', () => {
    for (const id of ['claude-x', 'claude-opus', 'claude-new-thing-2']) {
      expect(resolvePricing(id).pricing.inputPerMillion).toBeGreaterThan(0);
    }
  });

  it('leaves non-Claude models unpriced', () => {
    const r = resolvePricing('cohere/north-mini-code:free');
    expect(r.source).toBe('unpriced');
    expect(r.pricing.inputPerMillion).toBe(0);
  });

  it('uses a custom pricing table when provided', () => {
    const custom = { 'test-model': { ...CLAUDE_PRICING['claude-opus-4-6']!, inputPerMillion: 99 } };
    expect(getPricing('test-model', custom).inputPerMillion).toBe(99);
  });
});

describe('calculateCost', () => {
  it('bills cache writes at the 1-hour rate when the split is unknown', () => {
    // Opus 4.6: $5 input + $25 output + $10 1h write + $0.50 read
    expect(calculateCost(MTOK, 'claude-opus-4-6')).toBeCloseTo(40.5, 6);
  });

  it('uses per-model cache read rates', () => {
    const read = { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 1_000_000 };
    expect(calculateCost(read, 'claude-opus-5-5')).toBeCloseTo(0.2, 6);   // 0.05x
    expect(calculateCost(read, 'claude-fable-5-1')).toBeCloseTo(0.25, 6); // 0.025x
    expect(calculateCost(read, 'claude-fable-5')).toBeCloseTo(1, 6);      // 0.1x
  });

  it('bills the 5m/1h cache-write split at separate rates', () => {
    const usage = { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 1_000_000, cacheReadTokens: 0, cacheWrite5mTokens: 400_000, cacheWrite1hTokens: 600_000 };
    // Sonnet 4.6: 0.4 × $3.75 + 0.6 × $6
    expect(calculateCost(usage, 'claude-sonnet-4-6')).toBeCloseTo(1.5 + 3.6, 6);
  });

  it('applies Haiku 5.5 long-context rates above 100K prompt tokens', () => {
    const short = { inputTokens: 50_000, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 50_000 };
    const long = { ...short, cacheReadTokens: 50_001 };
    expect(calculateCost(short, 'claude-haiku-5-5')).toBeCloseTo(0.05 * 0.1 + 0.05 * 0.01, 9);
    expect(calculateCost(long, 'claude-haiku-5-5')).toBeCloseTo(0.05 * 0.5 + 0.050001 * 0.05, 9);
  });

  it('returns 0 for zero tokens', () => {
    expect(calculateCost({ inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 }, 'claude-opus-4-6')).toBe(0);
  });

  it('returns 0 for non-Claude models', () => {
    expect(calculateCost(MTOK, 'poolside/laguna-s-2.1:free')).toBe(0);
  });
});

describe('model names', () => {
  it('formats versions', () => {
    expect(modelDisplayName('claude-opus-5-5')).toBe('Opus 5.5');
    expect(modelDisplayName('claude-sonnet-5')).toBe('Sonnet 5');
    expect(modelDisplayName('claude-haiku-4-5-20251001')).toBe('Haiku 4.5');
    expect(modelDisplayName('claude-fable-5-1')).toBe('Fable 5.1');
    expect(modelDisplayName('claude-3-5-haiku-20241022')).toBe('Haiku 3.5');
    expect(modelDisplayName('claude-lyric-1')).toBe('Lyric 1');
  });

  it('returns families', () => {
    expect(modelFamilyName('claude-opus-4-8')).toBe('Opus');
    expect(modelFamilyName('claude-fable-5-1')).toBe('Fable');
  });

  it('leaves non-Claude ids unchanged', () => {
    expect(modelDisplayName('gpt-4')).toBe('gpt-4');
    expect(modelFamilyName('gpt-4')).toBe('gpt-4');
  });
});
