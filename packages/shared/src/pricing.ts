import type { UsageMetrics } from './types.js';

/**
 * Per-million-token pricing by model.
 *
 * Source: https://platform.claude.com/docs/en/about-claude/pricing
 * Updated: 2026-10-22
 *
 * To revise prices: edit CLAUDE_PRICING below and bump PRICING_VERSION. On
 * the next server start every stored entry is re-priced in the background,
 * so history follows the new table without a manual migration.
 *
 * Cache rates are listed per model rather than derived from multipliers —
 * newer models don't follow the old 1.25x / 2x / 0.1x pattern (e.g. Opus 5.5
 * cache reads are 0.05x input, Fable 5.1's are 0.025x).
 */
export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  /** 1-hour cache write — Claude Code's default, used when the TTL split is unknown. */
  cacheWritePerMillion: number;
  /** Cache hit / refresh. */
  cacheReadPerMillion: number;
  /** 5-minute cache write. Falls back to cacheWritePerMillion when absent. */
  cacheWrite5mPerMillion?: number;
  /** Higher rates for requests whose prompt (input + cache read + cache write) exceeds the threshold. */
  longContext?: { thresholdTokens: number; pricing: Omit<ModelPricing, 'longContext'> };
}

/** Bump whenever CLAUDE_PRICING changes — triggers a re-price of stored entries. */
export const PRICING_VERSION = '2026-10-22';

function rates(input: number, write5m: number, write1h: number, read: number, output: number): ModelPricing {
  return {
    inputPerMillion: input,
    outputPerMillion: output,
    cacheWritePerMillion: write1h,
    cacheReadPerMillion: read,
    cacheWrite5mPerMillion: write5m,
  };
}

/**
 * Official Anthropic first-party API pricing, keyed by model id without any
 * date suffix. Columns: input, 5m cache write, 1h cache write, cache read, output.
 */
export const CLAUDE_PRICING: Record<string, ModelPricing> = {
  'claude-fable-5-1':  rates(10,   12.5,  20,   0.25, 50),
  'claude-mythos-5-1': rates(10,   12.5,  20,   0.25, 50),
  'claude-fable-5':    rates(10,   12.5,  20,   1,    50),
  'claude-mythos-5':   rates(10,   12.5,  20,   1,    50),

  'claude-opus-5-5':   rates(4,    5,     8,    0.2,  20),
  'claude-opus-5':     rates(5,    6.25,  10,   0.5,  25),
  'claude-opus-4-8':   rates(5,    6.25,  10,   0.5,  25),
  'claude-opus-4-7':   rates(5,    6.25,  10,   0.5,  25),
  'claude-opus-4-6':   rates(5,    6.25,  10,   0.5,  25),
  'claude-opus-4-5':   rates(5,    6.25,  10,   0.5,  25),
  'claude-opus-4-1':   rates(15,   18.75, 30,   1.5,  75),
  'claude-opus-4':     rates(15,   18.75, 30,   1.5,  75),

  'claude-sonnet-5-5': rates(2,    2.5,   4,    0.1,  10),
  'claude-sonnet-5':   rates(2,    2.5,   4,    0.2,  10),
  'claude-sonnet-4-6': rates(3,    3.75,  6,    0.3,  15),
  'claude-sonnet-4-5': rates(3,    3.75,  6,    0.3,  15),
  'claude-sonnet-4':   rates(3,    3.75,  6,    0.3,  15),

  'claude-haiku-5-5': {
    ...rates(0.1, 0.125, 0.2, 0.01, 0.5),
    longContext: { thresholdTokens: 100_000, pricing: rates(0.5, 0.625, 1, 0.05, 2.5) },
  },
  'claude-haiku-4-5':  rates(1,    1.25,  2,    0.1,  5),
  'claude-haiku-3-5':  rates(0.8,  1,     1.6,  0.08, 4),
};

/** @deprecated Kept for older imports; use CLAUDE_PRICING. */
export const FALLBACK_PRICING = CLAUDE_PRICING;

const FREE: ModelPricing = { inputPerMillion: 0, outputPerMillion: 0, cacheWritePerMillion: 0, cacheReadPerMillion: 0 };

/**
 * How a model's price was found:
 *  - exact:      listed in the table
 *  - estimated:  an unlisted Claude model priced from the nearest version of its family
 *                (or from the newest Opus when the family itself is unknown)
 *  - unpriced:   not a Claude model (e.g. other providers routed through Claude Code) — costed at $0
 */
export type PricingSource = 'exact' | 'estimated' | 'unpriced';

export interface ResolvedPricing {
  pricing: ModelPricing;
  source: PricingSource;
  /** Table key the price came from, when any. */
  basedOn: string | null;
}

interface ParsedModel {
  family: string;
  /** Version as comparable numbers, e.g. [4, 5] for 4.5, [5] for 5. */
  version: number[];
}

/** Strip platform prefixes and snapshot suffixes: "us.anthropic.claude-opus-4-5-20251101-v1:0" → "claude-opus-4-5". */
export function normalizeModelId(model: string): string {
  let id = model.trim().toLowerCase();
  const at = id.indexOf('claude-');
  if (at > 0) id = id.slice(at);           // bedrock "anthropic." / region prefixes
  id = id.replace(/\[.*\]$/, '');          // "[1m]" context markers
  id = id.replace(/@.*$/, '');             // vertex "@20251101"
  id = id.replace(/-v\d+(:\d+)?$/, '');    // bedrock "-v1:0"
  id = id.replace(/-\d{8}$/, '');          // dated snapshots
  return id;
}

/**
 * "claude-opus-4-5" → { opus, [4,5] }; legacy "claude-3-5-haiku" → { haiku, [3,5] };
 * trailing qualifiers ("-preview", "-fast") are ignored.
 */
function parseModel(id: string): ParsedModel | null {
  const modern = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-[a-z].*)?$/.exec(id);
  if (modern) {
    const version = [Number(modern[2])];
    if (modern[3] !== undefined) version.push(Number(modern[3]));
    return { family: modern[1]!, version };
  }
  const legacy = /^claude-(\d+)(?:-(\d{1,2}))?-([a-z]+)(?:-.*)?$/.exec(id);
  if (legacy) {
    const version = [Number(legacy[1])];
    if (legacy[2] !== undefined) version.push(Number(legacy[2]));
    return { family: legacy[3]!, version };
  }
  const bare = /^claude-([a-z]+)(?:-|$)/.exec(id); // e.g. "claude-mythos-preview"
  if (bare) return { family: bare[1]!, version: [] };
  return null;
}

function compareVersions(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Known table entries for a family, oldest first. */
function familyEntries(table: Record<string, ModelPricing>, family: string): Array<{ key: string; version: number[] }> {
  return Object.keys(table)
    .map((key) => ({ key, parsed: parseModel(key) }))
    .filter((e): e is { key: string; parsed: ParsedModel } => e.parsed?.family === family)
    .map((e) => ({ key: e.key, version: e.parsed.version }))
    .sort((a, b) => compareVersions(a.version, b.version));
}

/**
 * Find pricing for any model id, including ones released after this table.
 *
 * An unlisted Claude model takes the price of the newest listed version of
 * its family that is not newer than it (or the oldest, for very old models).
 * A future "claude-opus-6" is therefore priced like Opus 5.5, not like Sonnet.
 */
export function resolvePricing(model: string, pricingTable?: Record<string, ModelPricing>): ResolvedPricing {
  const table = pricingTable ?? CLAUDE_PRICING;
  if (table[model]) return { pricing: table[model], source: 'exact', basedOn: model };

  const id = normalizeModelId(model);
  if (table[id]) return { pricing: table[id], source: 'exact', basedOn: id };

  if (!id.startsWith('claude-')) return { pricing: FREE, source: 'unpriced', basedOn: null };

  const parsed = parseModel(id);
  const sameFamily = parsed ? familyEntries(table, parsed.family) : [];
  if (parsed && sameFamily.length > 0) {
    const notNewer = sameFamily.filter((e) => compareVersions(e.version, parsed.version) <= 0);
    const pick = parsed.version.length === 0
      ? sameFamily[sameFamily.length - 1]!
      : (notNewer[notNewer.length - 1] ?? sameFamily[0]!);
    // Same family and version under a different spelling (e.g. legacy "claude-3-5-haiku").
    const sameVersion = parsed.version.length > 0 && compareVersions(pick.version, parsed.version) === 0;
    return { pricing: table[pick.key]!, source: sameVersion ? 'exact' : 'estimated', basedOn: pick.key };
  }

  // Unknown family: assume a flagship-tier model rather than under-reporting it.
  const opus = familyEntries(table, 'opus');
  const flagship = opus[opus.length - 1];
  if (flagship) return { pricing: table[flagship.key]!, source: 'estimated', basedOn: flagship.key };
  return { pricing: FREE, source: 'unpriced', basedOn: null };
}

/** Pricing for a model (see resolvePricing for how unlisted models are handled). */
export function getPricing(model: string, pricingTable?: Record<string, ModelPricing>): ModelPricing {
  return resolvePricing(model, pricingTable).pricing;
}

/**
 * Calculate cost in USD for a single usage entry.
 *
 * When the entry carries the 5m/1h cache-write split, each part is billed at
 * its own rate; any unsplit remainder is billed as a 1-hour write.
 */
export function calculateCost(
  usage: UsageMetrics,
  model: string,
  pricingTable?: Record<string, ModelPricing>,
): number {
  let pricing: Omit<ModelPricing, 'longContext'> = getPricing(model, pricingTable);
  const lc = (pricing as ModelPricing).longContext;
  const promptTokens = usage.inputTokens + usage.cacheCreationTokens + usage.cacheReadTokens;
  if (lc && promptTokens > lc.thresholdTokens) pricing = lc.pricing;

  const write5m = Math.min(usage.cacheWrite5mTokens ?? 0, usage.cacheCreationTokens);
  const write1h = usage.cacheCreationTokens - write5m;
  const write5mRate = pricing.cacheWrite5mPerMillion ?? pricing.cacheWritePerMillion;

  return (
    usage.inputTokens * pricing.inputPerMillion +
    usage.outputTokens * pricing.outputPerMillion +
    write5m * write5mRate +
    write1h * pricing.cacheWritePerMillion +
    usage.cacheReadTokens * pricing.cacheReadPerMillion
  ) / 1_000_000;
}

const FAMILY_NAMES: Record<string, string> = {
  opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku', fable: 'Fable', mythos: 'Mythos',
};

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "claude-opus-5-5" → "Opus"; non-Claude ids are returned unchanged. */
export function modelFamilyName(model: string): string {
  const parsed = parseModel(normalizeModelId(model));
  if (!parsed) return model;
  return FAMILY_NAMES[parsed.family] ?? titleCase(parsed.family);
}

/** "claude-opus-5-5" → "Opus 5.5", "claude-haiku-4-5-20251001" → "Haiku 4.5"; non-Claude ids unchanged. */
export function modelDisplayName(model: string): string {
  const parsed = parseModel(normalizeModelId(model));
  if (!parsed) return model;
  const family = FAMILY_NAMES[parsed.family] ?? titleCase(parsed.family);
  return parsed.version.length ? `${family} ${parsed.version.join('.')}` : family;
}
