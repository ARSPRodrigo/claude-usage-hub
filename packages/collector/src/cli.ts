#!/usr/bin/env node

import { Command } from 'commander';
import { COLLECTOR_VERSION } from '@claude-usage-hub/shared';
import { loadConfig, saveConfig, generateDefaultConfig, getConfigDir } from './config.js';
import { runOnce, runLoop } from './index.js';

const program = new Command();

program
  .name('claude-hub-collector')
  .description('Claude Usage Hub - Collector Agent')
  .version(COLLECTOR_VERSION);

program
  .command('run-once')
  .description('Run a single collection cycle and output the payload as JSON')
  .option('--upload', 'Upload the payload to the server', false)
  .action(async (opts) => {
    try {
      const result = await runOnce();

      if (opts.upload && result.payload.entries.length > 0) {
        const config = loadConfig();
        if (config?.serverUrl) {
          const { upload } = await import('./uploader.js');
          const success = await upload(result.payload, config.serverUrl, config.apiKey);
          if (!success) {
            console.error('Upload failed');
            process.exit(1);
          }
          console.log(`Uploaded ${result.payload.entries.length} entries`);
        }
      } else {
        // Output payload to stdout
        console.log(JSON.stringify(result.payload, null, 2));
      }

      console.error(`\n--- Stats ---`);
      console.error(`Files scanned: ${result.stats.filesScanned}`);
      console.error(`Entries parsed: ${result.stats.entriesParsed}`);
      console.error(`After dedup: ${result.stats.entriesAfterDedup}`);
      console.error(`New entries: ${result.stats.newEntries}`);
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command('run')
  .description('Run the collector in a continuous loop')
  .action(async () => {
    try {
      await runLoop();
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize the collector configuration')
  .requiredOption('--server <url>', 'Server URL')
  .requiredOption('--api-key <key>', 'API key for authentication')
  .option('--data-path <path>', 'Claude data path', '~/.claude/projects')
  .action((opts) => {
    const existing = loadConfig();
    if (existing) {
      console.log('Configuration already exists. Updating...');
    }

    const config = existing
      ? { ...existing, serverUrl: opts.server, apiKey: opts.apiKey }
      : generateDefaultConfig(opts.server, opts.apiKey);

    if (opts.dataPath) {
      config.claudeDataPath = opts.dataPath;
    }

    saveConfig(config);
    console.log(`Configuration saved to ${getConfigDir()}`);
    console.log(`Developer ID: ${config.developerId}`);
  });

program
  .command('status')
  .description('Show collector status and configuration')
  .action(() => {
    const config = loadConfig();
    if (!config) {
      console.log('Not configured. Run "claude-hub-collector init" first.');
      return;
    }

    console.log('Claude Usage Hub Collector');
    console.log('=========================');
    console.log(`Config dir:     ${getConfigDir()}`);
    console.log(`Developer ID:   ${config.developerId}`);
    console.log(`Server URL:     ${config.serverUrl}`);
    console.log(`Interval:       ${config.intervalMinutes} min`);
    console.log(`Data path:      ${config.claudeDataPath}`);
    console.log(`API key:        ${config.apiKey.slice(0, 8)}...`);
  });

program
  .command('install')
  .description('Install the collector as a background daemon (coming in Phase 4)')
  .action(() => {
    console.log('Daemon installation will be available in a future release.');
    console.log('For now, use "claude-hub-collector run" to run manually.');
  });

program
  .command('uninstall')
  .description('Remove the background daemon (coming in Phase 4)')
  .action(() => {
    console.log('Daemon uninstallation will be available in a future release.');
  });

program.parse();
