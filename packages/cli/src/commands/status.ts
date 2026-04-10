import { existsSync, statSync } from 'node:fs';
import { COLLECTOR_VERSION, SERVER_DEFAULTS } from '@claude-usage-hub/shared';
import { loadConfig, getConfigDir } from '@claude-usage-hub/collector/config';
import { createDb, runMigrations, getEntryCount } from '@claude-usage-hub/server';
import { getRawDb, closeDb } from '@claude-usage-hub/server';

export function statusCommand(): void {
  console.log(`Claude Usage Hub v${COLLECTOR_VERSION}`);
  console.log('');

  // Collector config
  const configDir = getConfigDir();
  const config = loadConfig();
  if (config) {
    console.log('Collector:');
    console.log(`  Config:       ${configDir}/config.json`);
    console.log(`  Developer ID: ${config.developerId}`);
    console.log(`  Data path:    ${config.claudeDataPath}`);
    console.log(`  Interval:     ${config.intervalMinutes} min`);
  } else {
    console.log('Collector: not configured');
    console.log(`  Run "pnpm start" to auto-initialize.`);
  }

  // Database
  const dbPath = SERVER_DEFAULTS.DB_PATH.replace(/^~/, process.env['HOME'] ?? '');
  console.log('');
  console.log('Database:');
  if (existsSync(dbPath)) {
    const size = statSync(dbPath).size;
    const sizeMb = (size / 1024 / 1024).toFixed(1);
    console.log(`  Path:    ${dbPath}`);
    console.log(`  Size:    ${sizeMb} MB`);

    try {
      const { raw } = createDb(dbPath);
      runMigrations(raw);
      const count = getEntryCount();
      console.log(`  Entries: ${count.toLocaleString()}`);

      // Show last entry timestamp
      const lastRow = raw
        .prepare('SELECT MAX(timestamp) as last_ts FROM usage_entries')
        .get() as { last_ts: string | null } | undefined;

      if (lastRow?.last_ts) {
        const lastDate = new Date(lastRow.last_ts);
        console.log(`  Latest:  ${lastDate.toLocaleString()}`);
      }

      closeDb();
    } catch (err) {
      console.log(`  Entries: could not read (${err instanceof Error ? err.message : 'unknown error'})`);
    }
  } else {
    console.log(`  Path:    ${dbPath}`);
    console.log(`  Status:  not created yet`);
    console.log(`  Run "pnpm start" to create the database.`);
  }
}
