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

/**
 * Upload an ingest payload to the server.
 *
 * Retries up to 3 times with exponential backoff.
 * On persistent failure, saves the payload to the outbox for the next cycle.
 */
export async function upload(
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

    // Wait before retry
    if (attempt < RETRY_DELAYS.length) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[attempt]));
    }
  }

  // All retries failed — save to outbox
  saveToOutbox(payload);
  return false;
}

/** Save a failed payload to the outbox directory. */
function saveToOutbox(payload: IngestPayload): void {
  const dir = OUTBOX_DIR();
  const filename = `${Date.now()}.json`;
  writeFileSync(join(dir, filename), JSON.stringify(payload), 'utf-8');
  console.error(`Payload saved to outbox: ${filename}`);
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
