import { existsSync, statSync } from 'node:fs';
import { COLLECTOR_VERSION, SERVER_DEFAULTS } from '@claude-usage-hub/shared';
import { loadConfig } from '@claude-usage-hub/collector/config';
import { createDb, runMigrations, getEntryCount } from '@claude-usage-hub/server';

export function statusCommand(): void {
  console.log(`Claude Usage Hub v${COLLECTOR_VERSION}`);
  console.log('');

  // Collector config
  const config = loadConfig();
  if (config) {
    console.log('Collector:');
    console.log(`  Developer ID: ${config.developerId}`);
    console.log(`  Data path:    ${config.claudeDataPath}`);
    console.log(`  Interval:     ${config.intervalMinutes} min`);
  } else {
    console.log('Collector: not configured');
  }

  // Database
  const dbPath = SERVER_DEFAULTS.DB_PATH.replace(/^~/, process.env['HOME'] ?? '');
  console.log('');
  console.log('Database:');
  if (existsSync(dbPath)) {
    const size = statSync(dbPath).size;
    const sizeMb = (size / 1024 / 1024).toFixed(1);
    console.log(`  Path: ${dbPath}`);
    console.log(`  Size: ${sizeMb} MB`);

    try {
      createDb(dbPath);
      runMigrations(require('better-sqlite3')(dbPath));
      console.log(`  Entries: ${getEntryCount()}`);
    } catch {
      console.log('  Entries: (could not read)');
    }
  } else {
    console.log(`  Path: ${dbPath} (not created yet)`);
  }
}
