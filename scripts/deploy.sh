#!/bin/sh
# Deploy script — run on the VM to pull the latest code and rebuild the server.
# Usage: bash scripts/deploy.sh
#
# Downloads collector.exe from the latest GitHub release so Windows users get
# the self-contained binary (no Node.js required). Falls back to a 0-byte
# placeholder if no release exists yet — the server returns 404 for empty
# files so install.ps1 correctly falls back to collector.js + Node.js.

set -e

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
GITHUB_REPO="ARSPRodrigo/claude-usage-hub"
EXE_URL="https://github.com/$GITHUB_REPO/releases/latest/download/collector.exe"

cd "$REPO_DIR"

echo "==> Pulling latest changes..."
git pull

echo "==> Fetching collector.exe from latest GitHub release..."
mkdir -p packages/collector/dist
if curl -sSfL "$EXE_URL" -o packages/collector/dist/collector.exe 2>/dev/null; then
  size=$(wc -c < packages/collector/dist/collector.exe)
  echo "    Downloaded collector.exe (${size} bytes)"
else
  echo "    No release asset found — placeholder used (Windows users need Node.js until a release is tagged)"
  touch packages/collector/dist/collector.exe
fi

echo "==> Building Docker image..."
docker compose build server

echo "==> Restarting server container..."
docker compose up -d server

echo ""
echo "Done! Server is up."
