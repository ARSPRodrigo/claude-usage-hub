import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULTS } from '@claude-usage-hub/shared';
import type { IngestPayload } from '@claude-usage-hub/shared';
import { ensureConfigDir, getConfigPath } from './config.js';

const OUTBOX_DIR = () => {
  const dir = join(getConfigPath(DEFAULTS.OUTBOX_DIR));
  if (!existsSync(dir)) {
    ensureConfigDir();
    mkdirSync(dir, { recursive: true });
  }
  return dir;
};

/** Retry delays in ms: 1s, 4s, 16s. */
const RETRY_DELAYS = [1000, 4000, 16000];

/** Maximum entries per batch to stay well under the 10 MB body limit. */
const BATCH_SIZE = 2000;

/**
 * Upload a single batch to the server with retry logic.
 * Returns true on success, false on persistent failure (payload saved to outbox).
 */
async function uploadBatch(
  payload: IngestPayload,
  serverUrl: string,
  apiKey: string,
): Promise<boolean> {
  const url = `${serverUrl.replace(/\/$/, '')}/api/v1/ingest`;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) return true;

      // Don't retry on client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        console.error(`Upload rejected (${response.status}): ${await response.text()}`);
        return false;
      }
    } catch (err) {
      // Network error — will retry
      if (attempt < RETRY_DELAYS.length) {
        console.error(`Upload attempt ${attempt + 1} failed, retrying...`);
      }
    }

    if (attempt < RETRY_DELAYS.length) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[attempt]));
    }
  }

  saveToOutbox(payload);
  return false;
}

/**
 * Upload an ingest payload to the server, splitting into batches if needed.
 *
 * Large payloads (e.g. first-run historical data) are split into BATCH_SIZE
 * chunks to stay under the server's 10 MB body limit.
 */
export async function upload(
  payload: IngestPayload,
  serverUrl: string,
  apiKey: string,
): Promise<boolean> {
  const { entries, ...rest } = payload;

  if (entries.length <= BATCH_SIZE) {
    return uploadBatch(payload, serverUrl, apiKey);
  }

  // Split into batches, preserving all other payload fields
  let allOk = true;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const ok = await uploadBatch({ ...rest, entries: batch }, serverUrl, apiKey);
    if (!ok) allOk = false;
  }
  return allOk;
}

/** Save a failed payload to the outbox directory. */
function saveToOutbox(payload: IngestPayload): void {
  const dir = OUTBOX_DIR();
  const filename = `${Date.now()}.json`;
  writeFileSync(join(dir, filename), JSON.stringify(payload), 'utf-8');
  console.error(`Payload saved to outbox: ${filename}`);
}

/** Return the number of payloads currently waiting in the outbox. */
export function getOutboxCount(): number {
  const dir = join(getConfigPath(DEFAULTS.OUTBOX_DIR));
  if (!existsSync(dir)) return 0;
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.json')).length;
  } catch {
    return 0;
  }
}

/**
 * Check server connectivity and API key validity.
 * Returns { ok: true } on success or { ok: false, error: string } on failure.
 */
export async function checkConnectivity(
  serverUrl: string,
  apiKey: string,
): Promise<{ ok: boolean; error?: string }> {
  const url = `${serverUrl.replace(/\/$/, '')}/api/v1/health`;
  try {
    const response = await fetch(url, {
      headers: { 'X-API-Key': apiKey },
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) return { ok: true };
    if (response.status === 401) return { ok: false, error: 'Invalid API key (401 Unauthorized)' };
    return { ok: false, error: `Server returned ${response.status}` };
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return { ok: false, error: 'Connection timed out after 5s' };
    }
    return { ok: false, error: `Cannot reach server: ${err instanceof Error ? err.message : err}` };
  }
}

/**
 * Retry any payloads sitting in the outbox.
 * Returns the number of successfully uploaded payloads.
 */
export async function retryOutbox(serverUrl: string, apiKey: string): Promise<number> {
  const dir = OUTBOX_DIR();
  if (!existsSync(dir)) return 0;

  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  let uploaded = 0;

  for (const file of files) {
    const filePath = join(dir, file);
    try {
      const payload = JSON.parse(readFileSync(filePath, 'utf-8')) as IngestPayload;
      const success = await upload(payload, serverUrl, apiKey);
      if (success) {
        unlinkSync(filePath);
        uploaded++;
      }
    } catch {
      // Skip corrupted outbox files
    }
  }

  return uploaded;
}
