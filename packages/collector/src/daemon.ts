import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { homedir, platform } from 'node:os';
import { execSync } from 'node:child_process';

export type Platform = 'macos' | 'linux' | 'windows' | 'unsupported';
export type InstallResult = { ok: true } | { ok: false; error: string };

export const DAEMON_LABEL = 'com.claude-usage-hub.collector';

/**
 * Detect the current OS platform.
 */
export function detectPlatform(): Platform {
  switch (platform()) {
    case 'darwin': return 'macos';
    case 'linux': return 'linux';
    case 'win32': return 'windows';
    default: return 'unsupported';
  }
}

/**
 * Resolve the absolute path to the Node.js executable and the collector CLI script.
 * Returns { nodePath, cliPath } suitable for use in daemon service files.
 */
export function resolveExecutable(): { nodePath: string; cliPath: string } {
  const nodePath = process.execPath;
  // process.argv[1] is the script being run (e.g. dist/cli.js or src/cli.ts via tsx)
  const cliPath = resolve(process.argv[1] ?? '');
  return { nodePath, cliPath };
}

// ---------------------------------------------------------------------------
// macOS — launchd plist
// ---------------------------------------------------------------------------

export function launchdPlistPath(): string {
  return `${homedir()}/Library/LaunchAgents/${DAEMON_LABEL}.plist`;
}

export function buildLaunchdPlist(nodePath: string, cliPath: string, logDir: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${DAEMON_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${cliPath}</string>
    <string>run</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${logDir}/collector.log</string>
  <key>StandardErrorPath</key>
  <string>${logDir}/collector-error.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${homedir()}</string>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
`;
}

export function installMacos(nodePath: string, cliPath: string, logDir: string): InstallResult {
  const plistPath = launchdPlistPath();
  const launchAgentsDir = dirname(plistPath);

  mkdirSync(launchAgentsDir, { recursive: true });
  mkdirSync(logDir, { recursive: true });

  writeFileSync(plistPath, buildLaunchdPlist(nodePath, cliPath, logDir), 'utf-8');

  try {
    // Unload first in case it's already loaded (ignore errors)
    try { execSync(`launchctl unload "${plistPath}" 2>/dev/null`, { stdio: 'ignore' }); } catch { /* ok */ }
    execSync(`launchctl load "${plistPath}"`, { stdio: 'pipe' });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: `launchctl load failed: ${err instanceof Error ? err.message : err}`,
    };
  }
}

export function uninstallMacos(): InstallResult {
  const plistPath = launchdPlistPath();
  if (!existsSync(plistPath)) {
    return { ok: false, error: 'Daemon is not installed (plist not found)' };
  }

  try {
    execSync(`launchctl unload "${plistPath}"`, { stdio: 'pipe' });
  } catch {
    // May fail if not loaded — continue to remove file
  }

  unlinkSync(plistPath);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Linux — systemd user service
// ---------------------------------------------------------------------------

export function systemdServicePath(): string {
  const configHome = process.env['XDG_CONFIG_HOME'] ?? `${homedir()}/.config`;
  return `${configHome}/systemd/user/${DAEMON_LABEL}.service`;
}

export function buildSystemdService(nodePath: string, cliPath: string, logDir: string): string {
  return `[Unit]
Description=Claude Usage Hub Collector
After=network.target

[Service]
Type=simple
ExecStart=${nodePath} ${cliPath} run
Restart=on-failure
RestartSec=30
StandardOutput=append:${logDir}/collector.log
StandardError=append:${logDir}/collector-error.log
Environment=HOME=${homedir()}

[Install]
WantedBy=default.target
`;
}

export function installLinux(nodePath: string, cliPath: string, logDir: string): InstallResult {
  const servicePath = systemdServicePath();
  mkdirSync(dirname(servicePath), { recursive: true });
  mkdirSync(logDir, { recursive: true });

  writeFileSync(servicePath, buildSystemdService(nodePath, cliPath, logDir), 'utf-8');

  try {
    execSync('systemctl --user daemon-reload', { stdio: 'pipe' });
    execSync(`systemctl --user enable --now ${DAEMON_LABEL}`, { stdio: 'pipe' });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: `systemctl failed: ${err instanceof Error ? err.message : err}\n` +
             `Service file written to ${servicePath}. You can enable manually:\n` +
             `  systemctl --user daemon-reload\n` +
             `  systemctl --user enable --now ${DAEMON_LABEL}`,
    };
  }
}

export function uninstallLinux(): InstallResult {
  const servicePath = systemdServicePath();
  if (!existsSync(servicePath)) {
    return { ok: false, error: 'Daemon is not installed (service file not found)' };
  }

  try {
    execSync(`systemctl --user disable --now ${DAEMON_LABEL}`, { stdio: 'pipe' });
  } catch {
    // May fail if not running — continue
  }

  unlinkSync(servicePath);

  try { execSync('systemctl --user daemon-reload', { stdio: 'pipe' }); } catch { /* ok */ }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Windows — Task Scheduler
// ---------------------------------------------------------------------------

export function buildWindowsTaskXml(nodePath: string, cliPath: string): string {
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Claude Usage Hub Collector</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
    </LogonTrigger>
  </Triggers>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>999</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${nodePath}</Command>
      <Arguments>"${cliPath}" run</Arguments>
      <WorkingDirectory>${homedir()}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
`;
}

export function installWindows(nodePath: string, cliPath: string, logDir: string): InstallResult {
  mkdirSync(logDir, { recursive: true });

  // Write temp XML file then import via schtasks
  const xmlPath = `${logDir}\\task.xml`;
  // UTF-16 LE with BOM — required by schtasks XML parser to detect encoding before parsing
  writeFileSync(xmlPath, '\uFEFF' + buildWindowsTaskXml(nodePath, cliPath), 'utf16le');

  try {
    execSync(`schtasks /create /xml "${xmlPath}" /tn "${DAEMON_LABEL}" /f`, { stdio: 'pipe' });
    try { unlinkSync(xmlPath); } catch { /* ok */ }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: `schtasks failed: ${err instanceof Error ? err.message : err}`,
    };
  }
}

export function uninstallWindows(): InstallResult {
  try {
    execSync(`schtasks /delete /tn "${DAEMON_LABEL}" /f`, { stdio: 'pipe' });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: `schtasks delete failed: ${err instanceof Error ? err.message : err}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Unified install / uninstall
// ---------------------------------------------------------------------------

export function getLogDir(): string {
  return `${homedir()}/.claude-usage-hub/logs`;
}

export function install(): InstallResult {
  const os = detectPlatform();
  const { nodePath, cliPath } = resolveExecutable();
  const logDir = getLogDir();

  switch (os) {
    case 'macos': return installMacos(nodePath, cliPath, logDir);
    case 'linux': return installLinux(nodePath, cliPath, logDir);
    case 'windows': return installWindows(nodePath, cliPath, logDir);
    default: return { ok: false, error: `Unsupported platform: ${platform()}` };
  }
}

export function uninstall(): InstallResult {
  const os = detectPlatform();
  switch (os) {
    case 'macos': return uninstallMacos();
    case 'linux': return uninstallLinux();
    case 'windows': return uninstallWindows();
    default: return { ok: false, error: `Unsupported platform: ${platform()}` };
  }
}

/**
 * Check whether the daemon is currently installed (service/plist file exists).
 */
export function isDaemonInstalled(): boolean {
  const os = detectPlatform();
  switch (os) {
    case 'macos': return existsSync(launchdPlistPath());
    case 'linux': return existsSync(systemdServicePath());
    case 'windows': {
      try {
        execSync(`schtasks /query /tn "${DAEMON_LABEL}"`, { stdio: 'pipe' });
        return true;
      } catch {
        return false;
      }
    }
    default: return false;
  }
}
