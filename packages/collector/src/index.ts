import type { IngestPayload, ScannedFile, UsageEntry } from '@claude-usage-hub/shared';
import { scanForFiles } from './scanner.js';
import { parseJsonlFile } from './parser.js';
import { loadCursors, saveCursors, getOffset, setOffset, pruneCursors } from './cursor.js';
import { dedup, loadSeenHashes, saveSeenHashes } from './dedup.js';
import { aggregate } from './aggregator.js';
import { readStatsSummary } from './stats-reader.js';
import { loadConfig } from './config.js';

export interface RunOnceResult {
  payload: IngestPayload;
  stats: {
    filesScanned: number;
    entriesParsed: number;
    entriesAfterDedup: number;
    newEntries: number;
  };
}

/**
 * Run a single collection cycle:
 * scan → parse → dedup → aggregate → return payload.
 */
export async function runOnce(): Promise<RunOnceResult> {
  const config = loadConfig();
  if (!config) {
    throw new Error(
      'Collector not configured. Run "claude-hub-collector init" first.',
    );
  }

  // 1. Scan for JSONL files
  const scannedFiles = await scanForFiles(config.claudeDataPath);

  // 2. Load cursors and parse only new data
  const cursors = loadCursors();
  const entriesByFile = new Map<string, UsageEntry[]>();
  const fileMetadata = new Map<string, ScannedFile>();
  let totalParsed = 0;

  for (const file of scannedFiles) {
    const offset = getOffset(cursors, file.filePath);
    const result = await parseJsonlFile(file.filePath, offset);

    if (result.entries.length > 0) {
      entriesByFile.set(file.filePath, result.entries);
      fileMetadata.set(file.filePath, file);
      totalParsed += result.entries.length;
    }

    setOffset(cursors, file.filePath, result.newOffset);
  }

  // 3. Deduplicate (keeps only last entry per messageId:requestId)
  const seenHashes = loadSeenHashes();
  const allEntries = Array.from(entriesByFile.values()).flat();
  const dedupedEntries = dedup(allEntries, seenHashes);

  // Build a lookup from deduped entry to its file for aggregation
  // We need file metadata for project alias mapping
  const entryToFile = new Map<string, string>();
  for (const [filePath, entries] of entriesByFile) {
    for (const e of entries) {
      entryToFile.set(`${e.messageId}:${e.requestId}`, filePath);
    }
  }

  // Rebuild entriesByFile with only the deduped entries
  const dedupedByFile = new Map<string, UsageEntry[]>();
  for (const entry of dedupedEntries) {
    const key = `${entry.messageId}:${entry.requestId}`;
    const filePath = entryToFile.get(key);
    if (!filePath) continue;

    const existing = dedupedByFile.get(filePath) ?? [];
    existing.push(entry);
    dedupedByFile.set(filePath, existing);
  }

  // 4. Read stats summary
  const statsSummary = readStatsSummary() ?? undefined;

  // 5. Aggregate into payload
  const payload = aggregate({
    entriesByFile: dedupedByFile,
    fileMetadata,
    developerId: config.developerId,
    salt: config.salt,
    statsSummary,
  });

  // 6. Persist state
  saveCursors(pruneCursors(cursors));
  saveSeenHashes(seenHashes);

  return {
    payload,
    stats: {
      filesScanned: scannedFiles.length,
      entriesParsed: totalParsed,
      entriesAfterDedup: dedupedEntries.length,
      newEntries: payload.entries.length,
    },
  };
}

/**
 * Run the collector in a loop at the configured interval.
 */
export async function runLoop(): Promise<never> {
  const config = loadConfig();
  if (!config) {
    throw new Error(
      'Collector not configured. Run "claude-hub-collector init" first.',
    );
  }

  const intervalMs = config.intervalMinutes * 60 * 1000;

  console.log(
    `Collector running every ${config.intervalMinutes} minutes. Press Ctrl+C to stop.`,
  );

  while (true) {
    try {
      const result = await runOnce();
      console.log(
        `[${new Date().toISOString()}] Scanned ${result.stats.filesScanned} files, ` +
          `${result.stats.newEntries} new entries`,
      );

      // Upload if there are entries and server is configured
      if (result.payload.entries.length > 0 && config.serverUrl) {
        const { upload } = await import('./uploader.js');
        const success = await upload(result.payload, config.serverUrl, config.apiKey);
        if (success) {
          console.log(`  Uploaded ${result.payload.entries.length} entries`);
        } else {
          console.error('  Upload failed (saved to outbox)');
        }
      }
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Error:`, err);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
