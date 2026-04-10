#!/usr/bin/env node

import { Command } from 'commander';
import { COLLECTOR_VERSION } from '@claude-usage-hub/shared';
import { loadConfig, saveConfig, generateDefaultConfig, getConfigDir, getLastUploadTime } from './config.js';
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

      if (opts.upload) {
        const config = loadConfig();
        if (config?.serverUrl) {
          const { upload, retryOutbox } = await import('./uploader.js');
          const { saveLastUploadTime: saveTs } = await import('./config.js');

          // Retry outbox first
          const retried = await retryOutbox(config.serverUrl, config.apiKey);
          if (retried > 0) console.error(`Retried ${retried} outbox payload(s)`);

          if (result.payload.entries.length > 0) {
            const success = await upload(result.payload, config.serverUrl, config.apiKey);
            if (!success) {
              console.error('Upload failed');
              process.exit(1);
            }
            saveTs();
            console.log(`Uploaded ${result.payload.entries.length} entries`);
          } else {
            console.log('No new entries to upload');
          }
        } else {
          console.error('No server URL configured');
          process.exit(1);
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
  .option('--skip-check', 'Skip connectivity check', false)
  .action(async (opts) => {
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

    // Verify connectivity before saving
    if (!opts.skipCheck) {
      process.stdout.write(`Checking connection to ${opts.server}... `);
      const { checkConnectivity } = await import('./uploader.js');
      const check = await checkConnectivity(opts.server, opts.apiKey);
      if (!check.ok) {
        console.log('FAILED');
        console.error(`Error: ${check.error}`);
        console.error('Use --skip-check to save config anyway.');
        process.exit(1);
      }
      console.log('OK');
    }

    saveConfig(config);
    console.log(`Configuration saved to ${getConfigDir()}`);
    console.log(`Developer ID: ${config.developerId}`);
  });

program
  .command('status')
  .description('Show collector status and configuration')
  .option('--check', 'Check server connectivity', false)
  .action(async (opts) => {
    const config = loadConfig();
    if (!config) {
      console.log('Not configured. Run "claude-hub-collector init" first.');
      return;
    }

    const { getOutboxCount } = await import('./uploader.js');
    const lastUpload = getLastUploadTime();
    const outboxCount = getOutboxCount();

    console.log('Claude Usage Hub Collector');
    console.log('=========================');
    console.log(`Config dir:     ${getConfigDir()}`);
    console.log(`Developer ID:   ${config.developerId}`);
    console.log(`Server URL:     ${config.serverUrl}`);
    console.log(`API key:        ${config.apiKey.slice(0, 12)}...`);
    console.log(`Interval:       ${config.intervalMinutes} min`);
    console.log(`Data path:      ${config.claudeDataPath}`);
    console.log(`Last upload:    ${lastUpload ? new Date(lastUpload).toLocaleString() : 'never'}`);
    console.log(`Outbox:         ${outboxCount} pending payload(s)`);

    if (opts.check) {
      process.stdout.write(`Connectivity:   `);
      const { checkConnectivity } = await import('./uploader.js');
      const check = await checkConnectivity(config.serverUrl, config.apiKey);
      console.log(check.ok ? 'OK' : `FAILED — ${check.error}`);
    }
  });

program
  .command('install')
  .description('Install the collector as a background daemon (launchd / systemd / Task Scheduler)')
  .action(async () => {
    const config = loadConfig();
    if (!config) {
      console.error('Not configured. Run "claude-hub-collector init" first.');
      process.exit(1);
    }

    const { install, detectPlatform, isDaemonInstalled } = await import('./daemon.js');

    if (isDaemonInstalled()) {
      console.log('Daemon is already installed. Reinstalling...');
    }

    console.log(`Installing daemon for platform: ${detectPlatform()}`);
    const result = install();

    if (result.ok) {
      console.log('Daemon installed and started successfully.');
      console.log('Logs are written to ~/.claude-usage-hub/logs/');
      console.log('To check status: claude-hub-collector status --check');
      console.log('To remove: claude-hub-collector uninstall');
    } else {
      console.error(`Installation failed: ${result.error}`);
      process.exit(1);
    }
  });

program
  .command('uninstall')
  .description('Stop and remove the background daemon')
  .action(async () => {
    const { uninstall, isDaemonInstalled } = await import('./daemon.js');

    if (!isDaemonInstalled()) {
      console.log('Daemon is not installed.');
      return;
    }

    const result = uninstall();
    if (result.ok) {
      console.log('Daemon stopped and removed.');
    } else {
      console.error(`Uninstall failed: ${result.error}`);
      process.exit(1);
    }
  });

program.parse();
