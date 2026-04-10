import { describe, it, expect } from 'vitest';
import {
  detectPlatform,
  buildLaunchdPlist,
  buildSystemdService,
  buildWindowsTaskXml,
  DAEMON_LABEL,
  launchdPlistPath,
  systemdServicePath,
} from '../daemon.js';

const NODE = '/usr/local/bin/node';
const CLI = '/home/alice/.claude-usage-hub/dist/cli.js';
const LOG_DIR = '/home/alice/.claude-usage-hub/logs';

describe('daemon', () => {
  describe('detectPlatform', () => {
    it('returns a known platform or unsupported', () => {
      const p = detectPlatform();
      expect(['macos', 'linux', 'windows', 'unsupported']).toContain(p);
    });
  });

  describe('buildLaunchdPlist', () => {
    it('produces a valid plist containing the node path and cli path', () => {
      const plist = buildLaunchdPlist(NODE, CLI, LOG_DIR);
      expect(plist).toContain('<?xml version="1.0"');
      expect(plist).toContain(DAEMON_LABEL);
      expect(plist).toContain(NODE);
      expect(plist).toContain(CLI);
      expect(plist).toContain('run');
      expect(plist).toContain(LOG_DIR);
      expect(plist).toContain('<key>KeepAlive</key>');
      expect(plist).toContain('<true/>');
    });

    it('includes RunAtLoad', () => {
      const plist = buildLaunchdPlist(NODE, CLI, LOG_DIR);
      expect(plist).toContain('<key>RunAtLoad</key>');
    });
  });

  describe('buildSystemdService', () => {
    it('produces a systemd unit file with correct ExecStart', () => {
      const service = buildSystemdService(NODE, CLI, LOG_DIR);
      expect(service).toContain('[Unit]');
      expect(service).toContain('[Service]');
      expect(service).toContain('[Install]');
      expect(service).toContain(`ExecStart=${NODE} ${CLI} run`);
      expect(service).toContain('Restart=on-failure');
      expect(service).toContain(LOG_DIR);
    });

    it('includes WantedBy=default.target', () => {
      const service = buildSystemdService(NODE, CLI, LOG_DIR);
      expect(service).toContain('WantedBy=default.target');
    });
  });

  describe('buildWindowsTaskXml', () => {
    it('produces a Task Scheduler XML with correct command', () => {
      const xml = buildWindowsTaskXml(NODE, CLI);
      expect(xml).toContain('<?xml version="1.0"');
      expect(xml).toContain(NODE);
      expect(xml).toContain(CLI);
      expect(xml).toContain('<LogonTrigger>');
      expect(xml).toContain('<Enabled>true</Enabled>');
      // Should not stop when going on battery
      expect(xml).toContain('<StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>');
    });

    it('sets infinite execution time limit', () => {
      const xml = buildWindowsTaskXml(NODE, CLI);
      expect(xml).toContain('<ExecutionTimeLimit>PT0S</ExecutionTimeLimit>');
    });
  });

  describe('path helpers', () => {
    it('launchdPlistPath contains the daemon label and plist extension', () => {
      const p = launchdPlistPath();
      expect(p).toContain(DAEMON_LABEL);
      expect(p.endsWith('.plist')).toBe(true);
      expect(p).toContain('LaunchAgents');
    });

    it('systemdServicePath contains the daemon label and .service extension', () => {
      const p = systemdServicePath();
      expect(p).toContain(DAEMON_LABEL);
      expect(p.endsWith('.service')).toBe(true);
    });
  });
});
