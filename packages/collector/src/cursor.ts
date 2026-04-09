import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { DEFAULTS } from '@claude-usage-hub/shared';
import type { CursorState } from '@claude-usage-hub/shared';
import { ensureConfigDir, getConfigPath } from './config.js';

const CURSORS_PATH = () => getConfigPath(DEFAULTS.CURSORS_FILE);

/** Load cursor state from disk. */
export function loadCursors(): CursorState {
  const path = CURSORS_PATH();
  if (!existsSync(path)) return {};

  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as CursorState;
  } catch {
    return {};
  }
}

/** Save cursor state to disk. */
export function saveCursors(state: CursorState): void {
  ensureConfigDir();
  writeFileSync(CURSORS_PATH(), JSON.stringify(state, null, 2), 'utf-8');
}

/** Get the byte offset for a specific file. Returns 0 if not tracked. */
export function getOffset(state: CursorState, filePath: string): number {
  return state[filePath] ?? 0;
}

/** Update the byte offset for a specific file. */
export function setOffset(state: CursorState, filePath: string, offset: number): void {
  state[filePath] = offset;
}

/**
 * Clean up cursors for files that no longer exist.
 * Prevents the cursor file from growing indefinitely.
 */
export function pruneCursors(state: CursorState): CursorState {
  const cleaned: CursorState = {};
  for (const [filePath, offset] of Object.entries(state)) {
    if (existsSync(filePath)) {
      cleaned[filePath] = offset;
    }
  }
  return cleaned;
}
