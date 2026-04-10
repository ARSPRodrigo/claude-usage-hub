import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { serve } from '@hono/node-server';
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
    const { readFileSync, existsSync } = await import('node:fs');
    const { join } = await import('node:path');

    // Serve static files (assets, favicon, etc.)
    app.get('*', (c, next) => {
      const urlPath = c.req.path;

      // Skip API routes
      if (urlPath.startsWith('/api/')) return next();

      // Try to serve a static file
      const filePath = join(dashboardDist, urlPath === '/' ? 'index.html' : urlPath);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath);
        const ext = filePath.split('.').pop() ?? '';
        const mimeTypes: Record<string, string> = {
          html: 'text/html',
          js: 'application/javascript',
          css: 'text/css',
          svg: 'image/svg+xml',
          png: 'image/png',
          ico: 'image/x-icon',
          json: 'application/json',
        };
        const contentType = mimeTypes[ext] ?? 'application/octet-stream';
        return c.body(content, 200, { 'Content-Type': contentType });
      }

      // SPA fallback: serve index.html for unmatched routes
      const indexHtml = readFileSync(join(dashboardDist, 'index.html'), 'utf-8');
      return c.html(indexHtml);
    });
  }

  // Start server — bind to localhost only for security
  const server = serve({ fetch: app.fetch, port, hostname: '127.0.0.1' });
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
