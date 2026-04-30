import type { ModelPricing } from './pricing.js';

/**
 * Competitor models grouped by capability tier for fair comparison.
 *
 * Pricing last updated: 30 April 2026
 *
 * Sources:
 *   - OpenAI:    developers.openai.com/api/docs/pricing
 *   - Google:    ai.google.dev/gemini-api/docs/pricing
 *   - xAI:       docs.x.ai/developers/models
 *   - DeepSeek:  api-docs.deepseek.com/quick_start/pricing
 *   - Mistral:   mistral.ai/pricing
 */
export interface CompetitorModel {
  id: string;
  displayName: string;
  provider: string;
  tier: 'opus' | 'sonnet';
  pricing: ModelPricing;
  supportsCaching: boolean;
}

export const COMPETITOR_MODELS: CompetitorModel[] = [
  // ═══════════════════════════════════════════════════════════
  // OPUS TIER — flagship reasoning, agentic coding
  // Comparable to Claude Opus 4.7 ($5 in / $25 out)
  // ═══════════════════════════════════════════════════════════
  {
    id: 'openai-gpt-5.5',
    displayName: 'GPT-5.5',
    provider: 'OpenAI',
    tier: 'opus',
    pricing: { inputPerMillion: 5, outputPerMillion: 30, cacheWritePerMillion: 5, cacheReadPerMillion: 0.5 },
    supportsCaching: true,
  },
  {
    id: 'google-gemini-3.1-pro',
    displayName: 'Gemini 3.1 Pro',
    provider: 'Google',
    tier: 'opus',
    pricing: { inputPerMillion: 2, outputPerMillion: 12, cacheWritePerMillion: 2, cacheReadPerMillion: 0.2 },
    supportsCaching: true,
  },
  {
    id: 'xai-grok-4.20',
    displayName: 'Grok 4.20',
    provider: 'xAI',
    tier: 'opus',
    pricing: { inputPerMillion: 2, outputPerMillion: 6, cacheWritePerMillion: 2, cacheReadPerMillion: 0.2 },
    supportsCaching: true,
  },
  {
    id: 'deepseek-v4-pro',
    displayName: 'DeepSeek V4 Pro',
    provider: 'DeepSeek',
    tier: 'opus',
    pricing: { inputPerMillion: 1.74, outputPerMillion: 3.48, cacheWritePerMillion: 1.74, cacheReadPerMillion: 0.0145 },
    supportsCaching: true,
  },

  // ═══════════════════════════════════════════════════════════
  // SONNET TIER — fast, capable daily-driver coding
  // Comparable to Claude Sonnet 4.6 ($3 in / $15 out)
  // ═══════════════════════════════════════════════════════════
  {
    id: 'openai-gpt-5.4',
    displayName: 'GPT-5.4',
    provider: 'OpenAI',
    tier: 'sonnet',
    pricing: { inputPerMillion: 2.5, outputPerMillion: 15, cacheWritePerMillion: 2.5, cacheReadPerMillion: 0.25 },
    supportsCaching: true,
  },
  {
    id: 'google-gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    provider: 'Google',
    tier: 'sonnet',
    pricing: { inputPerMillion: 1.25, outputPerMillion: 10, cacheWritePerMillion: 1.25, cacheReadPerMillion: 0.125 },
    supportsCaching: true,
  },
  {
    id: 'mistral-large-3',
    displayName: 'Mistral Large 3',
    provider: 'Mistral',
    tier: 'sonnet',
    pricing: { inputPerMillion: 0.5, outputPerMillion: 1.5, cacheWritePerMillion: 0, cacheReadPerMillion: 0 },
    supportsCaching: false,
  },
  {
    id: 'mistral-devstral-2',
    displayName: 'Devstral 2',
    provider: 'Mistral',
    tier: 'sonnet',
    pricing: { inputPerMillion: 0.4, outputPerMillion: 2, cacheWritePerMillion: 0, cacheReadPerMillion: 0 },
    supportsCaching: false,
  },
];

/** Cost breakdown for a single model applied to a token profile. */
export interface CostComparisonEntry {
  modelId: string;
  displayName: string;
  provider: string;
  tier: 'opus' | 'sonnet';
  inputCost: number;
  outputCost: number;
  cacheCost: number;
  totalCost: number;
}

/** Provider brand colors for charts. */
export const PROVIDER_COLORS: Record<string, string> = {
  OpenAI:    'oklch(0.55 0.12 160)',
  Google:    'oklch(0.60 0.15 100)',
  xAI:       'oklch(0.50 0.10 300)',
  DeepSeek:  'oklch(0.55 0.14 30)',
  Mistral:   'oklch(0.60 0.12 45)',
};

/**
 * Apply each competitor model's pricing to an aggregate token profile.
 *
 * For providers without caching support, cache tokens are rolled into
 * input tokens and priced at the standard input rate (conservative
 * estimate — what you'd pay without prompt caching).
 */
export function computeComparisonCosts(tokens: {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}): CostComparisonEntry[] {
  return COMPETITOR_MODELS.map((model) => {
    const p = model.pricing;
    let inputCost: number;
    let cacheCost: number;

    if (model.supportsCaching) {
      inputCost = (tokens.inputTokens / 1_000_000) * p.inputPerMillion;
      cacheCost =
        (tokens.cacheCreationTokens / 1_000_000) * p.cacheWritePerMillion +
        (tokens.cacheReadTokens / 1_000_000) * p.cacheReadPerMillion;
    } else {
      // Roll cache tokens into input for providers without caching
      const effectiveInput = tokens.inputTokens + tokens.cacheCreationTokens + tokens.cacheReadTokens;
      inputCost = (effectiveInput / 1_000_000) * p.inputPerMillion;
      cacheCost = 0;
    }

    const outputCost = (tokens.outputTokens / 1_000_000) * p.outputPerMillion;
    const totalCost = inputCost + outputCost + cacheCost;

    return {
      modelId: model.id,
      displayName: model.displayName,
      provider: model.provider,
      tier: model.tier,
      inputCost,
      outputCost,
      cacheCost,
      totalCost,
    };
  }).sort((a, b) => a.totalCost - b.totalCost);
}
