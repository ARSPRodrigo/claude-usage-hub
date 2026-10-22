import type Database from 'better-sqlite3';
import { calculateCost, PRICING_VERSION } from '@claude-usage-hub/shared';

const META_KEY = 'pricing_version';
const BATCH_SIZE = 2000;

/**
 * Re-price every stored usage entry when the pricing table changes.
 *
 * Costs are derived from the token counts, so a release that revises
 * CLAUDE_PRICING (and bumps PRICING_VERSION) corrects history automatically.
 * Runs in small batches, yielding between them, so ingest and dashboard
 * requests keep being served while it works. Safe to interrupt: progress is
 * checkpointed and the next start resumes where it stopped.
 */
export function startRepricing(raw: Database.Database, log: (msg: string) => void = console.log): Promise<number> {
  const getMeta = raw.prepare(`SELECT value FROM app_meta WHERE key = ?`);
  const setMeta = raw.prepare(`
    INSERT INTO app_meta (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `);
  const applied = (getMeta.get(META_KEY) as { value: string } | undefined)?.value;
  if (applied === PRICING_VERSION) return Promise.resolve(0);

  // Resume from a checkpoint only if it belongs to this pricing version.
  const progressKey = `${META_KEY}_progress`;
  const progress = (getMeta.get(progressKey) as { value: string } | undefined)?.value;
  const [progressVersion, progressRowid] = progress?.split('@') ?? [];
  let lastRowid = progressVersion === PRICING_VERSION ? Number(progressRowid) || 0 : 0;

  const select = raw.prepare(`
    SELECT rowid AS rid, model, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens,
           cache_write_5m_tokens, cache_write_1h_tokens, cost_usd
    FROM usage_entries WHERE rowid > ? ORDER BY rowid LIMIT ?
  `);
  const update = raw.prepare(`UPDATE usage_entries SET cost_usd = ? WHERE rowid = ?`);

  type Row = {
    rid: number; model: string; input_tokens: number; output_tokens: number;
    cache_creation_tokens: number; cache_read_tokens: number;
    cache_write_5m_tokens: number | null; cache_write_1h_tokens: number | null; cost_usd: number;
  };

  const runBatch = raw.transaction((rows: Row[]) => {
    let changed = 0;
    for (const r of rows) {
      const cost = calculateCost({
        inputTokens: r.input_tokens,
        outputTokens: r.output_tokens,
        cacheCreationTokens: r.cache_creation_tokens,
        cacheReadTokens: r.cache_read_tokens,
        cacheWrite5mTokens: r.cache_write_5m_tokens ?? undefined,
        cacheWrite1hTokens: r.cache_write_1h_tokens ?? undefined,
      }, r.model);
      if (Math.abs(cost - r.cost_usd) > 1e-9) {
        update.run(cost, r.rid);
        changed++;
      }
    }
    setMeta.run(progressKey, `${PRICING_VERSION}@${rows[rows.length - 1]!.rid}`);
    return changed;
  });

  log(`[pricing] re-pricing usage entries for pricing ${PRICING_VERSION} (was ${applied ?? 'unset'})`);
  let total = 0;
  return new Promise((resolve, reject) => {
    const step = () => {
      try {
        const rows = select.all(lastRowid, BATCH_SIZE) as Row[];
        if (rows.length === 0) {
          setMeta.run(META_KEY, PRICING_VERSION);
          log(`[pricing] done — ${total} entries re-priced`);
          resolve(total);
          return;
        }
        total += runBatch(rows);
        lastRowid = rows[rows.length - 1]!.rid;
        setImmediate(step);
      } catch (err) {
        log(`[pricing] re-pricing stopped: ${err instanceof Error ? err.message : String(err)} — will resume on next start`);
        reject(err);
      }
    };
    setImmediate(step);
  });
}
