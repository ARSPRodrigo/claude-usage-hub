import { Hono } from 'hono';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const downloads = new Hono();

function getCollectorBundlePath(): string {
  return (
    process.env['COLLECTOR_BUNDLE_PATH'] ??
    resolve(__dirname, '../../../../collector/dist/collector.bundle.cjs')
  );
}

function getNssmPath(): string {
  return (
    process.env['NSSM_PATH'] ??
    resolve(__dirname, '../../../../collector/vendor/nssm.exe')
  );
}

function getCollectorExePath(): string {
  return (
    process.env['COLLECTOR_EXE_PATH'] ??
    resolve(__dirname, '../../../../collector/dist/collector.exe')
  );
}

/** GET /download/collector.js — serve the bundled collector agent */
downloads.get('/download/collector.js', (c) => {
  const bundlePath = getCollectorBundlePath();
  if (!existsSync(bundlePath)) {
    return c.json({ error: 'Collector bundle not built yet' }, 404);
  }
  const content = readFileSync(bundlePath, 'utf-8');
  c.header('Content-Type', 'application/javascript; charset=utf-8');
  c.header('Content-Disposition', 'attachment; filename="collector.js"');
  c.header('Cache-Control', 'no-store');
  return c.body(content);
});

/** GET /download/nssm.exe — serve NSSM for Windows Service registration */
downloads.get('/download/nssm.exe', (c) => {
  const nssmPath = getNssmPath();
  if (!existsSync(nssmPath)) {
    return c.json({ error: 'nssm.exe not available on this server' }, 404);
  }
  const content = readFileSync(nssmPath);
  c.header('Content-Type', 'application/octet-stream');
  c.header('Content-Disposition', 'attachment; filename="nssm.exe"');
  c.header('Cache-Control', 'no-store');
  return c.body(content);
});

/**
 * GET /download/collector.exe — self-contained Windows collector built via
 * Node SEA. ~60MB so streamed rather than buffered. 404 when the .exe hasn't
 * been built/deployed yet so install.ps1 can fall back to collector.js.
 */
downloads.get('/download/collector.exe', (c) => {
  const exePath = getCollectorExePath();
  if (!existsSync(exePath)) {
    return c.json({ error: 'collector.exe not built yet' }, 404);
  }
  const { size } = statSync(exePath);
  c.header('Content-Type', 'application/octet-stream');
  c.header('Content-Disposition', 'attachment; filename="collector.exe"');
  c.header('Content-Length', String(size));
  c.header('Cache-Control', 'no-store');
  // Stream rather than readFileSync — keeps memory usage flat regardless of file size.
  return c.body(Readable.toWeb(createReadStream(exePath)) as ReadableStream);
});

/** GET /install.sh — Mac/Linux install script */
downloads.get('/install.sh', (c) => {
  c.header('Cache-Control', 'no-store');
  const origin = new URL(c.req.url).origin;
  const script = `#!/bin/sh
set -e

SERVER_URL="${origin}"
CHUB_DIR="$HOME/.claude-usage-hub"
COLLECTOR_PATH="$CHUB_DIR/collector.js"
LOG_DIR="$CHUB_DIR/logs"

mkdir -p "$CHUB_DIR" "$LOG_DIR"

if [ -z "$CHUB_API_KEY" ]; then
  echo "Error: CHUB_API_KEY environment variable is required."
  echo ""
  echo "Usage:"
  echo "  curl -sSL $SERVER_URL/install.sh | CHUB_API_KEY=chub_xxx sh"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is required but not found. Install Node.js 18+ and try again."
  exit 1
fi

NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Error: Node.js 18 or newer is required (found v$(node -v))."
  exit 1
fi

echo "Downloading collector..."
curl -sSL "$SERVER_URL/download/collector.js" -o "$COLLECTOR_PATH"

echo "Initializing..."
node "$COLLECTOR_PATH" init --server "$SERVER_URL" --api-key "$CHUB_API_KEY"

echo "Installing daemon..."
node "$COLLECTOR_PATH" install

echo ""
echo "Done! The collector daemon is now running."
echo "Check status:  node $COLLECTOR_PATH status --check"
echo "View logs:     tail -f $LOG_DIR/collector.log"
`;
  c.header('Content-Type', 'text/plain; charset=utf-8');
  return c.body(script);
});

/** GET /install.ps1 — Windows PowerShell install script */
downloads.get('/install.ps1', (c) => {
  c.header('Cache-Control', 'no-store');
  const origin = new URL(c.req.url).origin;
  const script = `#Requires -Version 5.1
param([string]$ApiKey = $env:CHUB_API_KEY)

$ErrorActionPreference = 'Stop'

# --- Elevation check -----------------------------------------------------------
# Installing a Windows Service requires Administrator rights. We refuse rather
# than auto-elevate - the auto-elevation path was a corporate-policy and UAC
# nightmare that produced spawn loops on some configurations. Just tell the
# user clearly what to do.
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Yellow
    Write-Host " This installer needs Administrator privileges" -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please close this window, then:"
    Write-Host "  1. Press Win + X"
    Write-Host "  2. Click 'Windows PowerShell (Admin)' or 'Terminal (Admin)'"
    Write-Host "  3. Re-paste the same install command from your Hub dashboard"
    Write-Host ""
    Write-Host "(You only need to do this once. The collector then runs as a"
    Write-Host " Windows Service in the background - no further admin needed.)"
    Write-Host ""
    exit 1
}

$ServerUrl    = "${origin}"
$ChubDir      = "$env:APPDATA\\claude-usage-hub"
# Logs live under the user's profile (the collector uses os.homedir() which
# resolves to USERPROFILE on Windows). APPDATA is just where we cache the
# downloaded collector binary.
$LogDir       = "$env:USERPROFILE\\.claude-usage-hub\\logs"

New-Item -ItemType Directory -Force -Path $ChubDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir  | Out-Null

if (-not $ApiKey) {
    Write-Host @"
CHUB_API_KEY is required.

Usage (save to file first, then run):
  Invoke-WebRequest -Uri "$ServerUrl/install.ps1" -OutFile "$env:TEMP\\install-chub.ps1" -UseBasicParsing
  \$env:CHUB_API_KEY = 'chub_xxx'
  powershell -ExecutionPolicy Bypass -File "$env:TEMP\\install-chub.ps1"
"@
    exit 1
}

# Prefer collector.exe (self-contained, no Node.js required).
# Fall back to collector.js (requires Node.js >= 18) if the .exe isn't served.
$ExeUrl  = "$ServerUrl/download/collector.exe"
$ExePath = "$ChubDir\\collector.exe"
$UseExe  = $false

try {
    $head = Invoke-WebRequest -Uri $ExeUrl -Method Head -UseBasicParsing -ErrorAction Stop
    if ($head.StatusCode -eq 200) {
        Write-Host "Downloading collector.exe (self-contained, no Node.js required)..."
        Invoke-WebRequest -Uri $ExeUrl -OutFile $ExePath -UseBasicParsing
        $UseExe = $true
    }
} catch {
    # 404 or network error - fall through to the Node.js path
}

if (-not $UseExe) {
    # Require Node.js >= 18 for the JS fallback
    try {
        $nodeVersion = node -e "process.stdout.write(process.versions.node)" 2>$null
        $nodeMajor   = [int]($nodeVersion -split '\\.')[0]
        if ($nodeMajor -lt 18) {
            Write-Error "Node.js 18 or newer is required (found v$nodeVersion)."
            exit 1
        }
    } catch {
        Write-Error "Node.js is required but not found. Install Node.js 18+ from https://nodejs.org and try again."
        exit 1
    }

    $CollectorPath = "$ChubDir\\collector.js"
    Write-Host "collector.exe not available on this Hub. Falling back to collector.js (requires Node.js)..."
    Invoke-WebRequest -Uri "$ServerUrl/download/collector.js" -OutFile $CollectorPath -UseBasicParsing
}

# Build the invocation command - direct .exe or 'node <path>' depending on what we downloaded.
if ($UseExe) {
    function Invoke-Collector { & $ExePath @args }
} else {
    function Invoke-Collector { & node $CollectorPath @args }
}

Write-Host "Initializing..."
Invoke-Collector init --server $ServerUrl --api-key $ApiKey

Write-Host "Installing Windows Service (via NSSM)..."
Invoke-Collector install

Write-Host ""
Write-Host "Done! The collector is now running as a Windows Service."
Write-Host "It starts automatically on boot and restarts on crash."
Write-Host ""
Write-Host "Check service status:  sc query ClaudeUsageHubCollector"
if ($UseExe) {
    Write-Host "Check upload status:   \`"$ExePath\`" status --check"
} else {
    Write-Host "Check upload status:   node \`"$CollectorPath\`" status --check"
}
Write-Host "View logs:             Get-Content \`"$LogDir\\collector.log\`" -Wait"
`;
  // Prepend UTF-8 BOM so Windows PowerShell 5.1 reads the file as UTF-8
  // rather than the system default code page (usually CP1252). Without
  // this, any non-ASCII byte in the script breaks the parser.
  c.header('Content-Type', 'text/plain; charset=utf-8');
  return c.body('﻿' + script);
});

export { downloads as downloadRoutes };
