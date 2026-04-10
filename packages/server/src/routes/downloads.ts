import { Hono } from 'hono';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const downloads = new Hono();

function getCollectorBundlePath(): string {
  return (
    process.env['COLLECTOR_BUNDLE_PATH'] ??
    resolve(__dirname, '../../../../collector/dist/collector.bundle.js')
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
  return c.body(content);
});

/** GET /install.sh — Mac/Linux install script */
downloads.get('/install.sh', (c) => {
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
  const origin = new URL(c.req.url).origin;
  const script = `$ErrorActionPreference = 'Stop'

$ServerUrl = "${origin}"
$ChubDir = "$env:APPDATA\\claude-usage-hub"
$CollectorPath = "$ChubDir\\collector.js"
$LogDir = "$ChubDir\\logs"

New-Item -ItemType Directory -Force -Path $ChubDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

if (-not $env:CHUB_API_KEY) {
    Write-Error "CHUB_API_KEY environment variable is required."
    Write-Host ""
    Write-Host "Usage:"
    Write-Host "  \$env:CHUB_API_KEY='chub_xxx'; irm $ServerUrl/install.ps1 | iex"
    exit 1
}

try {
    $nodeVersion = node -e "process.stdout.write(process.versions.node)" 2>$null
    $nodeMajor = [int]($nodeVersion -split '\\.')[0]
    if ($nodeMajor -lt 18) {
        Write-Error "Node.js 18 or newer is required (found v$nodeVersion)."
        exit 1
    }
} catch {
    Write-Error "Node.js is required but not found. Install Node.js 18+ and try again."
    exit 1
}

Write-Host "Downloading collector..."
Invoke-WebRequest -Uri "$ServerUrl/download/collector.js" -OutFile $CollectorPath -UseBasicParsing

Write-Host "Initializing..."
node $CollectorPath init --server $ServerUrl --api-key $env:CHUB_API_KEY

Write-Host "Installing daemon..."
node $CollectorPath install

Write-Host ""
Write-Host "Done! The collector daemon is now running."
Write-Host "Check status:  node $CollectorPath status --check"
Write-Host "View logs:     Get-Content $LogDir\\collector.log -Wait"
`;
  c.header('Content-Type', 'text/plain; charset=utf-8');
  return c.body(script);
});

export { downloads as downloadRoutes };
