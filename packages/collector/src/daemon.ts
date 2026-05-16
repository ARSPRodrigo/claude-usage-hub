import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { homedir, platform } from 'node:os';
import { execSync } from 'node:child_process';
import { expandHome, loadConfig, saveConfig } from './config.js';

export type Platform = 'macos' | 'linux' | 'windows' | 'unsupported';
export type InstallResult = { ok: true } | { ok: false; error: string };

/** Label used by the launchd + systemd + (legacy) schtasks installs. */
export const DAEMON_LABEL = 'com.claude-usage-hub.collector';

/** Windows Service name used by the NSSM-based install. */
export const WINDOWS_SERVICE_NAME = 'ClaudeUsageHubCollector';

/**
 * SHA-256 of the bundled nssm.exe (NSSM 2.24-101-g897c7ad, win64).
 * Must match packages/collector/vendor/nssm-sha256.txt.
 *
 * To update: replace packages/collector/vendor/nssm.exe, then run:
 *   shasum -a 256 packages/collector/vendor/nssm.exe
 * and paste the result here and in vendor/nssm-sha256.txt.
 *
 * Empty string disables verification (development only — not for production).
 */
const NSSM_SHA256 = 'eee9c44c29c2be011f1f1e43bb8c3fca888cb81053022ec5a0060035de16d848';

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
 */
export function resolveExecutable(): { nodePath: string; cliPath: string } {
  if (isRunningAsSea()) {
    // SEA binary: process.execPath IS the collector — no separate script needed
    return { nodePath: process.execPath, cliPath: '' };
  }
  const nodePath = process.execPath;
  const cliPath = resolve(process.argv[1] ?? '');
  return { nodePath, cliPath };
}

/** Detect if running as a Node SEA executable (Node 21.7+ / 20.12+). */
function isRunningAsSea(): boolean {
  try {
    return (require('node:sea') as { isSea(): boolean }).isSea();
  } catch {
    return false;
  }
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
// Windows — NSSM Windows Service
//
// Replaces the previous Task Scheduler approach which was unreliable:
//   - LogonTrigger is session-scoped and doesn't recover after silent crashes
//   - Task doesn't resume on machine reboot without a fresh user logon
//
// NSSM registers a proper Windows Service (SCM-managed): starts on boot,
// restarts automatically on crash, survives lock/remote-desktop sessions.
// ---------------------------------------------------------------------------

/** Stable path where nssm.exe is stored after first download. */
export function nssmExePath(): string {
  return join(homedir(), '.claude-usage-hub', 'nssm.exe');
}

/**
 * Build the ordered list of NSSM commands needed to install the service.
 * Pure function — no execSync inside — so tests don't need to mock child_process.
 *
 * NOTE: AppEnvironmentExtra MUST be a single call; multiple calls overwrite
 * each other in the Windows registry (REG_MULTI_SZ). All env vars go here.
 */
export function buildNssmCommands(
  serviceName: string,
  executablePath: string,
  executableArgs: string,
  logDir: string,
  userProfile: string,
): Array<{ cmd: string; args: string[] }> {
  const programArgs = executableArgs ? executableArgs.split(' ') : [];
  return [
    { cmd: 'install', args: [serviceName, executablePath, ...programArgs] },
    { cmd: 'set', args: [serviceName, 'AppDirectory', userProfile] },
    { cmd: 'set', args: [serviceName, 'AppStdout', join(logDir, 'collector.log')] },
    { cmd: 'set', args: [serviceName, 'AppStderr', join(logDir, 'collector-error.log')] },
    { cmd: 'set', args: [serviceName, 'AppRestartDelay', '30000'] },
    { cmd: 'set', args: [serviceName, 'AppThrottle', '10000'] },
    // Single call — sets USERPROFILE (used by Node.js os.homedir() on Windows),
    // HOME (fallback), and HOMEPATH (legacy Windows). Multiple calls would
    // overwrite the registry value leaving only the last variable.
    {
      cmd: 'set', args: [
        serviceName, 'AppEnvironmentExtra',
        `USERPROFILE=${userProfile}`,
        `HOME=${userProfile}`,
        `HOMEPATH=\\Users\\${basename(userProfile)}`,
      ],
    },
    { cmd: 'start', args: [serviceName] },
  ];
}

/**
 * Check if the current process has Administrator privileges on Windows.
 * Uses fltMC (Filter Manager) which always requires elevation — more reliable
 * than `net session` which fails when the Server service is disabled.
 */
function isElevatedWindows(): boolean {
  try {
    execSync('fltMC', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove the old Task Scheduler entry if it exists.
 * Called at the start of installWindows for seamless upgrades.
 */
function migrateFromSchtasks(): void {
  try {
    execSync(`schtasks /query /tn "${DAEMON_LABEL}"`, { stdio: 'pipe' });
    // Task exists — remove it
    execSync(`schtasks /delete /tn "${DAEMON_LABEL}" /f`, { stdio: 'ignore' });
    console.log('Migrated: removed legacy Task Scheduler entry.');
  } catch {
    // Not present — nothing to do
  }
}

/**
 * Expand tilde in the stored claudeDataPath for existing users.
 * Without this, existing configs with "~/.claude/projects" would fail if
 * the service runs as LocalSystem before USERPROFILE is applied.
 */
function migrateConfigTildePath(): void {
  const config = loadConfig();
  if (config?.claudeDataPath?.startsWith('~')) {
    config.claudeDataPath = expandHome(config.claudeDataPath);
    saveConfig(config);
  }
}

/**
 * Ensure nssm.exe is available at nssmExePath().
 * If already present, returns the path immediately.
 * Otherwise downloads from the Hub server and verifies SHA-256.
 */
async function ensureNssm(serverUrl?: string): Promise<string> {
  const dest = nssmExePath();
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest)) return dest;

  if (!serverUrl) {
    throw new Error(
      `nssm.exe not found. Either:\n` +
      `  1. Run "collector init" first so a server URL is configured, OR\n` +
      `  2. Download nssm.exe manually from https://nssm.cc/download and place it at:\n` +
      `     ${dest}`,
    );
  }

  process.stdout.write('Downloading nssm.exe from server... ');
  const res = await fetch(
    `${serverUrl.replace(/\/$/, '')}/download/nssm.exe`,
    { signal: AbortSignal.timeout(30_000) },
  );
  if (!res.ok) {
    throw new Error(
      `Failed to download nssm.exe from server: HTTP ${res.status}.\n` +
      `Place nssm.exe manually at ${dest}`,
    );
  }

  const buf = Buffer.from(await res.arrayBuffer());

  // Verify SHA-256 checksum when configured. Empty NSSM_SHA256 skips the check
  // (useful during development; always populate for production deployments).
  if (NSSM_SHA256) {
    const { createHash } = await import('node:crypto');
    const actual = createHash('sha256').update(buf).digest('hex');
    if (actual !== NSSM_SHA256) {
      throw new Error(
        `nssm.exe checksum mismatch.\n` +
        `  Expected: ${NSSM_SHA256}\n` +
        `  Got:      ${actual}\n` +
        `Refusing to use this binary. Contact your Hub administrator.`,
      );
    }
  }

  writeFileSync(dest, buf);
  console.log('OK');
  return dest;
}

export async function installWindows(
  nodePath: string,
  cliPath: string,
  logDir: string,
): Promise<InstallResult> {
  // Must run as Administrator to register a Windows Service.
  if (!isElevatedWindows()) {
    return {
      ok: false,
      error:
        'Administrator privileges are required to install the Windows Service.\n' +
        'Right-click PowerShell → "Run as Administrator", then re-run:\n' +
        `  node collector.bundle.cjs install`,
    };
  }

  // Migrate old Task Scheduler entry and expand tilde in stored config.
  migrateFromSchtasks();
  migrateConfigTildePath();
  mkdirSync(logDir, { recursive: true });

  // Ensure nssm.exe is present (download from Hub if needed).
  const config = loadConfig();
  let nssmPath: string;
  try {
    nssmPath = await ensureNssm(config?.serverUrl);
  } catch (err) {
    return { ok: false, error: String(err) };
  }

  // Helper: run a single nssm command, quoting all arguments.
  const runNssm = (cmd: string, args: string[]) => {
    const quoted = args.map((a) => `"${a}"`).join(' ');
    execSync(`"${nssmPath}" ${cmd} ${quoted}`, { stdio: 'pipe' });
  };

  try {
    // Idempotent: stop + remove any existing service registration.
    try { runNssm('stop', [WINDOWS_SERVICE_NAME]); } catch { /* not running */ }
    try { runNssm('remove', [WINDOWS_SERVICE_NAME, 'confirm']); } catch { /* not registered */ }

    // Build and execute the ordered NSSM command sequence.
    const userProfile = homedir();
    const execArgs = cliPath ? `"${cliPath}" run` : 'run';
    const cmds = buildNssmCommands(
      WINDOWS_SERVICE_NAME,
      nodePath,
      execArgs,
      logDir,
      userProfile,
    );
    for (const { cmd, args } of cmds) {
      runNssm(cmd, args);
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: `NSSM service registration failed: ${err instanceof Error ? err.message : err}`,
    };
  }
}

export function uninstallWindows(): InstallResult {
  const nssmPath = nssmExePath();

  try {
    if (existsSync(nssmPath)) {
      try { execSync(`"${nssmPath}" stop "${WINDOWS_SERVICE_NAME}"`, { stdio: 'ignore' }); } catch { /* ok */ }
      execSync(`"${nssmPath}" remove "${WINDOWS_SERVICE_NAME}" confirm`, { stdio: 'pipe' });
    } else {
      // nssm.exe was deleted but the service may still be registered — sc.exe fallback.
      try { execSync(`sc stop "${WINDOWS_SERVICE_NAME}"`, { stdio: 'ignore' }); } catch { /* ok */ }
      execSync(`sc delete "${WINDOWS_SERVICE_NAME}"`, { stdio: 'pipe' });
    }
    // Clean up any leftover schtasks entry from previous versions.
    try { execSync(`schtasks /delete /tn "${DAEMON_LABEL}" /f`, { stdio: 'ignore' }); } catch { /* ok */ }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: `Service removal failed: ${err instanceof Error ? err.message : err}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Unified install / uninstall
// ---------------------------------------------------------------------------

export function getLogDir(): string {
  return `${homedir()}/.claude-usage-hub/logs`;
}

export async function install(): Promise<InstallResult> {
  const os = detectPlatform();
  const { nodePath, cliPath } = resolveExecutable();
  const logDir = getLogDir();

  switch (os) {
    case 'macos': return Promise.resolve(installMacos(nodePath, cliPath, logDir));
    case 'linux': return Promise.resolve(installLinux(nodePath, cliPath, logDir));
    case 'windows': return installWindows(nodePath, cliPath, logDir);
    default: return Promise.resolve({ ok: false, error: `Unsupported platform: ${platform()}` });
  }
}

export async function uninstall(): Promise<InstallResult> {
  const os = detectPlatform();
  switch (os) {
    case 'macos': return Promise.resolve(uninstallMacos());
    case 'linux': return Promise.resolve(uninstallLinux());
    case 'windows': return Promise.resolve(uninstallWindows());
    default: return Promise.resolve({ ok: false, error: `Unsupported platform: ${platform()}` });
  }
}

/**
 * Check whether the daemon is currently installed.
 */
export function isDaemonInstalled(): boolean {
  const os = detectPlatform();
  switch (os) {
    case 'macos': return existsSync(launchdPlistPath());
    case 'linux': return existsSync(systemdServicePath());
    case 'windows': {
      // Use sc.exe (always available) rather than nssm.exe which may have been removed.
      try {
        execSync(`sc query "${WINDOWS_SERVICE_NAME}"`, { stdio: 'pipe' });
        return true;
      } catch {
        return false;
      }
    }
    default: return false;
  }
}
