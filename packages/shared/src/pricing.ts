import { TIERED_PRICING_THRESHOLD } from './constants.js';
import type { UsageMetrics } from './types.js';

/**
 * Per-million-token pricing by model.
 *
 * These are hardcoded fallback values. The server fetches live pricing
 * from LiteLLM and uses these only when the fetch fails.
 *
 * Rates as of April 2026. Tiered pricing: above 200k input tokens,
 * rates increase (for 1M context models).
 */
export interface ModelPricing {
  inputPerMillion: number;
  inputAbove200kPerMillion: number;
  outputPerMillion: number;
  outputAbove200kPerMillion: number;
  cacheCreationPerMillion: number;
  cacheReadPerMillion: number;
}

export const FALLBACK_PRICING: Record<string, ModelPricing> = {
  'claude-opus-4-6': {
    inputPerMillion: 15.0,
    inputAbove200kPerMillion: 15.0,
    outputPerMillion: 75.0,
    outputAbove200kPerMillion: 75.0,
    cacheCreationPerMillion: 18.75,
    cacheReadPerMillion: 1.5,
  },
  'claude-sonnet-4-6': {
    inputPerMillion: 3.0,
    inputAbove200kPerMillion: 6.0,
    outputPerMillion: 15.0,
    outputAbove200kPerMillion: 30.0,
    cacheCreationPerMillion: 3.75,
    cacheReadPerMillion: 0.3,
  },
  'claude-haiku-4-5-20251001': {
    inputPerMillion: 0.8,
    inputAbove200kPerMillion: 1.6,
    outputPerMillion: 4.0,
    outputAbove200kPerMillion: 8.0,
    cacheCreationPerMillion: 1.0,
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

  // Prefix match (e.g., "claude-opus-4-6-20260401" → "claude-opus-4-6")
  for (const [key, pricing] of Object.entries(table)) {
    if (model.startsWith(key)) return pricing;
  }

  return DEFAULT_PRICING;
}

/**
 * Calculate cost in USD for a single usage entry.
 *
 * Supports tiered pricing: input tokens above the threshold are charged
 * at a higher rate.
 */
export function calculateCost(
  usage: UsageMetrics,
  model: string,
  pricingTable?: Record<string, ModelPricing>,
): number {
  const pricing = getPricing(model, pricingTable);

  // Input tokens with tiered pricing
  let inputCost: number;
  if (usage.inputTokens <= TIERED_PRICING_THRESHOLD) {
    inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPerMillion;
  } else {
    const baseCost = (TIERED_PRICING_THRESHOLD / 1_000_000) * pricing.inputPerMillion;
    const overageCost =
      ((usage.inputTokens - TIERED_PRICING_THRESHOLD) / 1_000_000) *
      pricing.inputAbove200kPerMillion;
    inputCost = baseCost + overageCost;
  }

  // Output tokens with tiered pricing
  let outputCost: number;
  if (usage.outputTokens <= TIERED_PRICING_THRESHOLD) {
    outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPerMillion;
  } else {
    const baseCost = (TIERED_PRICING_THRESHOLD / 1_000_000) * pricing.outputPerMillion;
    const overageCost =
      ((usage.outputTokens - TIERED_PRICING_THRESHOLD) / 1_000_000) *
      pricing.outputAbove200kPerMillion;
    outputCost = baseCost + overageCost;
  }

  // Cache tokens (flat rate)
  const cacheCost =
    (usage.cacheCreationTokens / 1_000_000) * pricing.cacheCreationPerMillion +
    (usage.cacheReadTokens / 1_000_000) * pricing.cacheReadPerMillion;

  return inputCost + outputCost + cacheCost;
}
