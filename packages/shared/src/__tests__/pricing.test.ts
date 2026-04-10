import { describe, it, expect } from 'vitest';
import { calculateCost, getPricing, FALLBACK_PRICING } from '../pricing.js';
import type { UsageMetrics } from '../types.js';

describe('getPricing', () => {
  it('returns exact match for known models', () => {
    const pricing = getPricing('claude-opus-4-6');
    expect(pricing.inputPerMillion).toBe(5.0);
    expect(pricing.outputPerMillion).toBe(25.0);
  });

  it('returns prefix match for versioned models', () => {
    const pricing = getPricing('claude-haiku-4-5-20251001');
    expect(pricing.inputPerMillion).toBe(1.0);
    expect(pricing.outputPerMillion).toBe(5.0);
  });

  it('returns Sonnet pricing for unknown models', () => {
    const pricing = getPricing('unknown-model-xyz');
    expect(pricing.inputPerMillion).toBe(3.0);
    expect(pricing.outputPerMillion).toBe(15.0);
  });

  it('uses custom pricing table when provided', () => {
    const custom = { 'test-model': { ...FALLBACK_PRICING['claude-opus-4-6']!, inputPerMillion: 99 } };
    const pricing = getPricing('test-model', custom);
    expect(pricing.inputPerMillion).toBe(99);
  });
});

describe('calculateCost', () => {
  it('calculates cost for Opus with all token types', () => {
    const usage: UsageMetrics = {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheCreationTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
    };
    const cost = calculateCost(usage, 'claude-opus-4-6');
    // $5 input + $25 output + $10 cache write + $0.50 cache read = $40.50
    expect(cost).toBeCloseTo(40.5, 2);
  });

  it('calculates cost for Sonnet', () => {
    const usage: UsageMetrics = {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    };
    const cost = calculateCost(usage, 'claude-sonnet-4-6');
    // $3 input + $15 output = $18
    expect(cost).toBeCloseTo(18.0, 2);
  });

  it('calculates cost for Haiku', () => {
    const usage: UsageMetrics = {
      inputTokens: 500_000,
      outputTokens: 100_000,
      cacheCreationTokens: 200_000,
      cacheReadTokens: 1_000_000,
    };
    const cost = calculateCost(usage, 'claude-haiku-4-5-20251001');
    // $0.50 + $0.50 + $0.40 + $0.10 = $1.50
    expect(cost).toBeCloseTo(1.5, 2);
  });

  it('returns 0 for zero tokens', () => {
    const usage: UsageMetrics = {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    };
    expect(calculateCost(usage, 'claude-opus-4-6')).toBe(0);
  });

  it('uses default pricing for unknown models', () => {
    const usage: UsageMetrics = {
      inputTokens: 1_000_000,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    };
    // Unknown model uses Sonnet pricing: $3/MTok
    expect(calculateCost(usage, 'unknown')).toBeCloseTo(3.0, 2);
  });
});
