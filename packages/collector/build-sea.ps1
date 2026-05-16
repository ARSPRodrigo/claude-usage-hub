#Requires -Version 5.1
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Build a self-contained Windows collector.exe via Node Single Executable
# Application (SEA). Runs on Windows only (needs a Windows node.exe to inject
# the SEA blob into).
#
# Output: packages/collector/dist/collector.exe (~60MB, no Node.js required
# on target machines).
#
# Required Node.js version: 20.12+ or 21.7+ (for stable SEA support).
# Required env (optional): CODESIGN_PFX + CODESIGN_PASSWORD for code-signing.
# ---------------------------------------------------------------------------

Write-Host "==> [1/5] Building CJS bundle..."
node bundle.cjs
if (-not (Test-Path dist/collector.bundle.cjs)) {
    throw "bundle.cjs did not produce dist/collector.bundle.cjs"
}

Write-Host "==> [2/5] Generating SEA preparation blob..."
node --experimental-sea-config sea-config.json
if (-not (Test-Path dist/sea-prep.blob)) {
    throw "node --experimental-sea-config did not produce dist/sea-prep.blob"
}

Write-Host "==> [3/5] Copying node.exe as base binary..."
$nodePath = (Get-Command node).Source
Write-Host "    Source: $nodePath"
Copy-Item $nodePath dist/collector.exe -Force

Write-Host "==> [4/5] Removing existing Authenticode signature (if any)..."
# Some Node.js distributions ship signed; postject can't inject into a signed
# binary. signtool may not be on PATH on every runner — wrap in try/ignore
# since it's also a no-op for unsigned binaries.
try {
    signtool remove /s dist/collector.exe 2>$null
    Write-Host "    Signature removed."
} catch {
    Write-Host "    No signature to remove (or signtool unavailable). Continuing."
}

Write-Host "==> [5/5] Injecting SEA blob with postject..."
# Pinned to the alpha version referenced in the Node.js SEA documentation.
# The fuse sentinel is a constant defined by Node.js itself.
npx --yes postject@1.0.0-alpha.6 dist/collector.exe NODE_SEA_BLOB dist/sea-prep.blob `
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

# Optional: code-sign the final binary so it doesn't trip corporate AV.
if ($env:CODESIGN_PFX) {
    Write-Host "==> Signing collector.exe..."
    signtool sign /f $env:CODESIGN_PFX /p $env:CODESIGN_PASSWORD `
        /tr http://timestamp.digicert.com /td sha256 dist/collector.exe
}

$sizeMB = [math]::Round((Get-Item dist/collector.exe).Length / 1MB, 1)
Write-Host ""
Write-Host "Built dist/collector.exe ($sizeMB MB)"
