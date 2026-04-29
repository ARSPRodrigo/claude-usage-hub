import type { ModelPricing } from './pricing.js';

/**
 * A model from any provider, with its API pricing and caching support.
 *
 * Pricing sources (verified April 2026):
 *   - Anthropic: platform.claude.com/docs/en/about-claude/pricing
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
  pricing: ModelPricing;
  supportsCaching: boolean;
}

export const COMPETITOR_MODELS: CompetitorModel[] = [
  // ── Anthropic ──────────────────────────────────────────────
  {
    id: 'anthropic-opus-4.7',
    displayName: 'Claude Opus 4.7',
    provider: 'Anthropic',
    pricing: { inputPerMillion: 5, outputPerMillion: 25, cacheWritePerMillion: 10, cacheReadPerMillion: 0.5 },
    supportsCaching: true,
  },
  {
    id: 'anthropic-sonnet-4.6',
    displayName: 'Claude Sonnet 4.6',
    provider: 'Anthropic',
    pricing: { inputPerMillion: 3, outputPerMillion: 15, cacheWritePerMillion: 6, cacheReadPerMillion: 0.3 },
    supportsCaching: true,
  },
  {
    id: 'anthropic-haiku-4.5',
    displayName: 'Claude Haiku 4.5',
    provider: 'Anthropic',
    pricing: { inputPerMillion: 1, outputPerMillion: 5, cacheWritePerMillion: 2, cacheReadPerMillion: 0.1 },
    supportsCaching: true,
  },

  // ── OpenAI ─────────────────────────────────────────────────
  {
    id: 'openai-gpt-5.5',
    displayName: 'GPT-5.5',
    provider: 'OpenAI',
    pricing: { inputPerMillion: 5, outputPerMillion: 30, cacheWritePerMillion: 5, cacheReadPerMillion: 0.5 },
    supportsCaching: true,
  },
  {
    id: 'openai-gpt-5.4',
    displayName: 'GPT-5.4',
    provider: 'OpenAI',
    pricing: { inputPerMillion: 2.5, outputPerMillion: 15, cacheWritePerMillion: 2.5, cacheReadPerMillion: 0.25 },
    supportsCaching: true,
  },
  {
    id: 'openai-gpt-5.4-mini',
    displayName: 'GPT-5.4 Mini',
    provider: 'OpenAI',
    pricing: { inputPerMillion: 0.75, outputPerMillion: 4.5, cacheWritePerMillion: 0.75, cacheReadPerMillion: 0.075 },
    supportsCaching: true,
  },
  {
    id: 'openai-gpt-5.4-nano',
    displayName: 'GPT-5.4 Nano',
    provider: 'OpenAI',
    pricing: { inputPerMillion: 0.2, outputPerMillion: 1.25, cacheWritePerMillion: 0.2, cacheReadPerMillion: 0.02 },
    supportsCaching: true,
  },

  // ── Google ─────────────────────────────────────────────────
  {
    id: 'google-gemini-3.1-pro',
    displayName: 'Gemini 3.1 Pro',
    provider: 'Google',
    pricing: { inputPerMillion: 2, outputPerMillion: 12, cacheWritePerMillion: 2, cacheReadPerMillion: 0.2 },
    supportsCaching: true,
  },
  {
    id: 'google-gemini-3-flash',
    displayName: 'Gemini 3 Flash',
    provider: 'Google',
    pricing: { inputPerMillion: 0.5, outputPerMillion: 3, cacheWritePerMillion: 0.5, cacheReadPerMillion: 0.05 },
    supportsCaching: true,
  },
  {
    id: 'google-gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    provider: 'Google',
    pricing: { inputPerMillion: 1.25, outputPerMillion: 10, cacheWritePerMillion: 1.25, cacheReadPerMillion: 0.125 },
    supportsCaching: true,
  },

  // ── xAI ────────────────────────────────────────────────────
  {
    id: 'xai-grok-4.20',
    displayName: 'Grok 4.20',
    provider: 'xAI',
    pricing: { inputPerMillion: 2, outputPerMillion: 6, cacheWritePerMillion: 2, cacheReadPerMillion: 0.2 },
    supportsCaching: true,
  },

  // ── DeepSeek ───────────────────────────────────────────────
  {
    id: 'deepseek-v4-flash',
    displayName: 'DeepSeek V4 Flash',
    provider: 'DeepSeek',
    pricing: { inputPerMillion: 0.14, outputPerMillion: 0.28, cacheWritePerMillion: 0.14, cacheReadPerMillion: 0.0028 },
    supportsCaching: true,
  },
  {
    id: 'deepseek-v4-pro',
    displayName: 'DeepSeek V4 Pro',
    provider: 'DeepSeek',
    pricing: { inputPerMillion: 0.435, outputPerMillion: 0.87, cacheWritePerMillion: 0.435, cacheReadPerMillion: 0.003625 },
    supportsCaching: true,
  },

  // ── Mistral ────────────────────────────────────────────────
  {
    id: 'mistral-large-3',
    displayName: 'Mistral Large 3',
    provider: 'Mistral',
    pricing: { inputPerMillion: 0.5, outputPerMillion: 1.5, cacheWritePerMillion: 0, cacheReadPerMillion: 0 },
    supportsCaching: false,
  },
  {
    id: 'mistral-devstral-2',
    displayName: 'Devstral 2',
    provider: 'Mistral',
    pricing: { inputPerMillion: 0.4, outputPerMillion: 2, cacheWritePerMillion: 0, cacheReadPerMillion: 0 },
    supportsCaching: false,
  },
];

/** Cost breakdown for a single model applied to a token profile. */
export interface CostComparisonEntry {
  modelId: string;
  displayName: string;
  provider: string;
  inputCost: number;
  outputCost: number;
  cacheCost: number;
  totalCost: number;
  isAnthropic: boolean;
}

/** Provider brand colors for charts. */
export const PROVIDER_COLORS: Record<string, string> = {
  Anthropic: 'oklch(0.55 0.14 220)',
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
      inputCost,
      outputCost,
      cacheCost,
      totalCost,
      isAnthropic: model.provider === 'Anthropic',
    };
  }).sort((a, b) => a.totalCost - b.totalCost);
}
