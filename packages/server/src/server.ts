import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { serve } from '@hono/node-server';
import type { ServerConfig } from '@claude-usage-hub/shared';
import { createApp } from './app.js';
import { createDb } from './db/connection.js';
import { runMigrations } from './db/migrate.js';
import { loadServerConfig } from './config.js';

/**
 * Start the Hono server with SQLite database.
 *
 * Returns a handle to close the server.
 */
export async function startServer(
  configOverrides?: Partial<ServerConfig>,
): Promise<{ close: () => void; config: ServerConfig }> {
  const config = loadServerConfig(configOverrides);

  // Ensure DB directory exists
  mkdirSync(dirname(config.dbPath), { recursive: true });

  // Initialize database
  const { raw } = createDb(config.dbPath);
  runMigrations(raw);

  // Create app
  const app = createApp();

  // Start server — bind to localhost only in local mode
  const server = serve({
    fetch: app.fetch,
    port: config.port,
    hostname: config.mode === 'local' ? '127.0.0.1' : '0.0.0.0',
  });

  return {
    close: () => {
      server.close();
    },
    config,
  };
}

// Allow running directly: `tsx src/server.ts`
const isDirectRun =
  process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js');

if (isDirectRun) {
  const { config } = await startServer();
  console.log(`Server running at http://localhost:${config.port}`);
  console.log(`Mode: ${config.mode}`);
  console.log(`Database: ${config.dbPath}`);
}
