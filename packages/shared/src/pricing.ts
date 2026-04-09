import type { UsageMetrics } from './types.js';

/**
 * Per-million-token pricing by model.
 *
 * Source: https://platform.claude.com/docs/en/about-claude/pricing
 * Updated: April 2026
 *
 * Cache pricing uses multipliers on base input price:
 *   - 5-min cache write: 1.25x base input
 *   - 1-hour cache write: 2x base input
 *   - Cache read/hit: 0.1x base input
 *
 * Opus 4.6 and Sonnet 4.6 include full 1M context at standard pricing
 * (no tiered pricing above 200k).
 */
export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  cacheWritePerMillion: number;   // 1h cache write (2x input) — Claude Code default
  cacheReadPerMillion: number;    // cache hit (0.1x input)
}

/**
 * Official Anthropic API pricing as of April 2026.
 *
 * Claude Code uses 1-hour cache writes by default (2x base input price).
 * Cache reads are 0.1x base input price.
 */
export const FALLBACK_PRICING: Record<string, ModelPricing> = {
  // Opus 4.6: $5 input, $25 output
  'claude-opus-4-6': {
    inputPerMillion: 5.0,
    outputPerMillion: 25.0,
    cacheWritePerMillion: 10.0,   // 2x $5
    cacheReadPerMillion: 0.5,     // 0.1x $5
  },
  // Opus 4.5: $5 input, $25 output
  'claude-opus-4-5': {
    inputPerMillion: 5.0,
    outputPerMillion: 25.0,
    cacheWritePerMillion: 10.0,
    cacheReadPerMillion: 0.5,
  },
  // Sonnet 4.6: $3 input, $15 output
  'claude-sonnet-4-6': {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheWritePerMillion: 6.0,    // 2x $3
    cacheReadPerMillion: 0.3,     // 0.1x $3
  },
  // Sonnet 4.5: $3 input, $15 output
  'claude-sonnet-4-5': {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheWritePerMillion: 6.0,
    cacheReadPerMillion: 0.3,
  },
  // Haiku 4.5: $1 input, $5 output
  'claude-haiku-4-5': {
    inputPerMillion: 1.0,
    outputPerMillion: 5.0,
    cacheWritePerMillion: 2.0,    // 2x $1
    cacheReadPerMillion: 0.1,     // 0.1x $1
  },
  // Haiku 3.5: $0.80 input, $4 output
  'claude-haiku-3-5': {
    inputPerMillion: 0.8,
    outputPerMillion: 4.0,
    cacheWritePerMillion: 1.6,
    cacheReadPerMillion: 0.08,
  },
};

/** Default pricing for unknown models (uses Sonnet rates). */
const DEFAULT_PRICING = FALLBACK_PRICING['claude-sonnet-4-6']!;

/**
 * Find pricing for a model. Tries exact match, then prefix match.
 */
export function getPricing(
  model: string,
  pricingTable?: Record<string, ModelPricing>,
): ModelPricing {
  const table = pricingTable ?? FALLBACK_PRICING;

  // Exact match
  if (table[model]) return table[model];

  // Prefix match (e.g., "claude-haiku-4-5-20251001" → "claude-haiku-4-5")
  for (const [key, pricing] of Object.entries(table)) {
    if (model.startsWith(key)) return pricing;
  }

  return DEFAULT_PRICING;
}

/**
 * Calculate cost in USD for a single usage entry.
 *
 * No tiered pricing for Opus 4.6 and Sonnet 4.6 — full 1M context
 * is billed at the same per-token rate.
 */
export function calculateCost(
  usage: UsageMetrics,
  model: string,
  pricingTable?: Record<string, ModelPricing>,
): number {
  const pricing = getPricing(model, pricingTable);

  const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPerMillion;
  const cacheWriteCost = (usage.cacheCreationTokens / 1_000_000) * pricing.cacheWritePerMillion;
  const cacheReadCost = (usage.cacheReadTokens / 1_000_000) * pricing.cacheReadPerMillion;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}
