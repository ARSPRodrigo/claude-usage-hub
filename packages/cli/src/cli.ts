#!/usr/bin/env node

import { Command } from 'commander';
import { COLLECTOR_VERSION } from '@claude-usage-hub/shared';

const program = new Command();

program
  .name('claude-usage-hub')
  .description('Claude Code Usage Hub - Monitor your token usage')
  .version(COLLECTOR_VERSION);

program
  .command('start')
  .description('Start the dashboard with automatic data collection')
  .option('-p, --port <number>', 'Server port', '8080')
  .option('-d, --db-path <path>', 'Database file path', '~/.claude-usage-hub/usage.db')
  .option('-i, --interval <minutes>', 'Collection interval in minutes', '5')
  .action(async (opts) => {
    const { startCommand } = await import('./commands/start.js');
    await startCommand({
      port: parseInt(opts.port, 10),
      dbPath: opts.dbPath,
      interval: parseInt(opts.interval, 10),
    });
  });

program
  .command('status')
  .description('Show collector and database status')
  .action(async () => {
    const { statusCommand } = await import('./commands/status.js');
    statusCommand();
  });

program.parse();
