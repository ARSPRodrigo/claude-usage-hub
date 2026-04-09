import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { DEFAULTS } from '@claude-usage-hub/shared';
import type { AliasMap } from '@claude-usage-hub/shared';
import { ensureConfigDir, getConfigPath } from './config.js';

const ALIASES_PATH = () => getConfigPath(DEFAULTS.ALIASES_FILE);

/** Generate an opaque alias for a project directory using SHA256 + salt. */
export function hashProjectDir(projectDir: string, salt: string): string {
  return createHash('sha256')
    .update(projectDir + salt)
    .digest('hex')
    .slice(0, 12);
}

/** Load the local alias mapping (hash → original project dir). */
export function loadAliases(): AliasMap {
  const path = ALIASES_PATH();
  if (!existsSync(path)) return {};

  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as AliasMap;
  } catch {
    return {};
  }
}

/** Save the alias mapping to disk. */
export function saveAliases(aliases: AliasMap): void {
  ensureConfigDir();
  writeFileSync(ALIASES_PATH(), JSON.stringify(aliases, null, 2), 'utf-8');
}

/**
 * Get the opaque alias for a project directory.
 *
 * Creates and persists the mapping if this is the first time
 * we've seen this project directory.
 */
export function getProjectAlias(
  projectDir: string,
  salt: string,
  aliases: AliasMap,
): string {
  const hash = hashProjectDir(projectDir, salt);

  // Store reverse mapping locally so the developer can look up their own aliases
  if (!aliases[hash]) {
    aliases[hash] = projectDir;
  }

  return hash;
}
