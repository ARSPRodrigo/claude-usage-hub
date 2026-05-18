import { describe, it, expect } from 'vitest';
import {
  detectPlatform,
  buildLaunchdPlist,
  buildSystemdService,
  buildNssmCommands,
  buildScheduledTaskXml,
  DAEMON_LABEL,
  WINDOWS_SERVICE_NAME,
  launchdPlistPath,
  systemdServicePath,
  nssmExePath,
} from '../daemon.js';

const NODE = '/usr/local/bin/node';
const CLI = '/home/alice/.claude-usage-hub/dist/cli.js';
const LOG_DIR = '/home/alice/.claude-usage-hub/logs';
const USER_PROFILE = '/home/alice';

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

  describe('buildNssmCommands', () => {
    const cmds = buildNssmCommands(WINDOWS_SERVICE_NAME, NODE, `"${CLI}" run`, LOG_DIR, USER_PROFILE);

    it('produces exactly 8 commands', () => {
      expect(cmds).toHaveLength(8);
    });

    it('first command installs the service with executable and args', () => {
      const install = cmds[0];
      expect(install?.cmd).toBe('install');
      expect(install?.args).toContain(WINDOWS_SERVICE_NAME);
      expect(install?.args).toContain(NODE);
    });

    it('sets AppStdout log path', () => {
      const stdoutCmd = cmds.find((c) => c.args.includes('AppStdout'));
      expect(stdoutCmd).toBeDefined();
      expect(stdoutCmd?.args.some((a) => a.includes('collector.log'))).toBe(true);
    });

    it('sets AppStderr log path', () => {
      const stderrCmd = cmds.find((c) => c.args.includes('AppStderr'));
      expect(stderrCmd).toBeDefined();
      expect(stderrCmd?.args.some((a) => a.includes('collector-error.log'))).toBe(true);
    });

    it('sets AppRestartDelay', () => {
      const delayCmd = cmds.find((c) => c.args.includes('AppRestartDelay'));
      expect(delayCmd?.args).toContain('30000');
    });

    it('sets all environment variables in a SINGLE AppEnvironmentExtra command', () => {
      const envCmds = cmds.filter((c) => c.args.includes('AppEnvironmentExtra'));
      // Must be exactly one call — multiple calls overwrite each other in the registry.
      expect(envCmds).toHaveLength(1);
      const envCmd = envCmds[0]!;
      const envArgs = envCmd.args.join(' ');
      expect(envArgs).toContain('USERPROFILE=');
      expect(envArgs).toContain('HOME=');
      expect(envArgs).toContain('HOMEPATH=');
    });

    it('USERPROFILE is set to the userProfile argument', () => {
      const envCmd = cmds.find((c) => c.args.includes('AppEnvironmentExtra'))!;
      expect(envCmd.args.some((a) => a.startsWith(`USERPROFILE=${USER_PROFILE}`))).toBe(true);
    });

    it('last command starts the service', () => {
      const last = cmds[cmds.length - 1];
      expect(last?.cmd).toBe('start');
      expect(last?.args).toContain(WINDOWS_SERVICE_NAME);
    });
  });

  describe('buildScheduledTaskXml (non-admin fallback)', () => {
    const xml = buildScheduledTaskXml(NODE, CLI, LOG_DIR);

    it('is valid XML with Task root element', () => {
      expect(xml).toContain('<?xml version="1.0"');
      expect(xml).toContain('<Task ');
      expect(xml).toContain('</Task>');
    });

    it('uses powershell.exe with -WindowStyle Hidden to suppress console', () => {
      expect(xml).toContain('<Command>powershell.exe</Command>');
      expect(xml).toContain('-WindowStyle Hidden');
    });

    it('includes the node path and cli path in the powershell command', () => {
      expect(xml).toContain(NODE);
      expect(xml).toContain(CLI);
    });

    it('includes LogonTrigger so the task starts on user logon', () => {
      expect(xml).toContain('<LogonTrigger>');
      expect(xml).toContain('<Enabled>true</Enabled>');
    });

    it('has RestartOnFailure configured', () => {
      expect(xml).toContain('<RestartOnFailure>');
      expect(xml).toContain('<Interval>PT1M</Interval>');
      expect(xml).toContain('<Count>999</Count>');
    });

    it('runs at LeastPrivilege (no elevation required)', () => {
      expect(xml).toContain('<RunLevel>LeastPrivilege</RunLevel>');
    });

    it('starts when available (no missed-trigger window)', () => {
      expect(xml).toContain('<StartWhenAvailable>true</StartWhenAvailable>');
    });

    it('does not stop when on battery', () => {
      expect(xml).toContain('<StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>');
    });

    it('for SEA binary (empty cliPath) uses exe run directly', () => {
      const seaXml = buildScheduledTaskXml(NODE, '', LOG_DIR);
      expect(seaXml).toContain(NODE);
      expect(seaXml).not.toContain(CLI);
    });
  });

  describe('constants', () => {
    it('WINDOWS_SERVICE_NAME is defined and non-empty', () => {
      expect(typeof WINDOWS_SERVICE_NAME).toBe('string');
      expect(WINDOWS_SERVICE_NAME.length).toBeGreaterThan(0);
    });

    it('DAEMON_LABEL is defined and non-empty', () => {
      expect(typeof DAEMON_LABEL).toBe('string');
      expect(DAEMON_LABEL.length).toBeGreaterThan(0);
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

    it('nssmExePath contains .claude-usage-hub and ends with nssm.exe', () => {
      const p = nssmExePath();
      expect(p).toContain('.claude-usage-hub');
      expect(p.endsWith('nssm.exe')).toBe(true);
    });
  });
});
