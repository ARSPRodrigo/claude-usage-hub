import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { COLLECTOR_VERSION, SERVER_DEFAULTS } from '@claude-usage-hub/shared';
import { runOnce } from '@claude-usage-hub/collector';
import { loadConfig, saveConfig, generateDefaultConfig } from '@claude-usage-hub/collector/config';
import { createApp, createDb, runMigrations, insertEntries, getEntryCount } from '@claude-usage-hub/server';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Resolve the dashboard dist directory.
 * Tries several possible locations relative to the CLI package.
 */
function findDashboardDist(): string | null {
  const candidates = [
    resolve(__dirname, '../../dashboard/dist'),        // dev: from cli/src/
    resolve(__dirname, '../../../dashboard/dist'),      // built: from cli/dist/
    resolve(__dirname, '../../../../packages/dashboard/dist'),  // monorepo root
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Run the collector and ingest results directly into SQLite.
 */
async function collectAndIngest(): Promise<number> {
  try {
    const result = await runOnce();
    if (result.payload.entries.length > 0) {
      return insertEntries(result.payload.entries);
    }
    return 0;
  } catch (err) {
    console.error('Collection error:', err instanceof Error ? err.message : err);
    return 0;
  }
}

export interface StartOptions {
  port?: number;
  dbPath?: string;
  interval?: number;
}

export async function startCommand(opts: StartOptions): Promise<void> {
  const port = opts.port ?? SERVER_DEFAULTS.PORT;
  const dbPath = opts.dbPath ?? SERVER_DEFAULTS.DB_PATH;
  const intervalMinutes = opts.interval ?? 5;

  // Ensure collector config exists (auto-init for local mode)
  let config = loadConfig();
  if (!config) {
    config = generateDefaultConfig('http://localhost:' + port, 'local-mode');
    saveConfig(config);
    console.log('Auto-initialized collector config.');
  }

  // Initialize database
  const expandedDbPath = dbPath.replace(/^~/, process.env['HOME'] ?? '');
  const { raw } = createDb(expandedDbPath);
  runMigrations(raw);

  // Run initial collection
  console.log('Scanning Claude Code usage data...');
  const inserted = await collectAndIngest();
  const total = getEntryCount();
  console.log(`Ingested ${inserted} new entries (${total} total in database).`);

  // Create Hono app and add dashboard static serving
  const app = createApp();
  const dashboardDist = findDashboardDist();

  if (dashboardDist) {
    // Serve static assets
    app.use('/assets/*', serveStatic({ root: dashboardDist }));

    // SPA fallback: serve index.html for non-API routes
    const { readFileSync } = await import('node:fs');
    const indexHtml = readFileSync(resolve(dashboardDist, 'index.html'), 'utf-8');
    app.get('*', (c) => {
      if (c.req.path.startsWith('/api/')) return c.notFound();
      return c.html(indexHtml);
    });
  }

  // Start server
  const server = serve({ fetch: app.fetch, port });
  console.log('');
  console.log(`  Claude Usage Hub v${COLLECTOR_VERSION}`);
  console.log(`  Dashboard: http://localhost:${port}`);
  console.log(`  Database:  ${expandedDbPath}`);
  console.log(`  Refresh:   every ${intervalMinutes} minutes`);
  if (!dashboardDist) {
    console.log('  Warning:   Dashboard not found. Run "pnpm --filter dashboard build" first.');
    console.log(`  API only:  http://localhost:${port}/api/v1/health`);
  }
  console.log('');

  // Set up periodic re-collection
  const intervalId = setInterval(async () => {
    const n = await collectAndIngest();
    if (n > 0) {
      console.log(`[${new Date().toISOString()}] Ingested ${n} new entries.`);
    }
  }, intervalMinutes * 60 * 1000);

  // Graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down...');
    clearInterval(intervalId);
    server.close();
    raw.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
