#requires -Version 5.1
<#
.SYNOPSIS
  Dev-box half of the deploy: build and push to the mapped sandbox drive.

.DESCRIPTION
  Run this on the developer workstation. It will:
    1. npm run build (produces dist\ for the SPA).
    2. robocopy dist\   -> <Target>\dist\
    3. robocopy server\ -> <Target>\server\   (excluding *.test.ts)
    4. Copy package.json, package-lock.json, ecosystem.config.cjs,
       scripts\deploy.ps1.
    5. Remind you to run 'scripts\deploy.ps1' on the server.

  This script deliberately does NOT run 'npm install' on the target,
  because native modules (better-sqlite3) MUST be compiled against the
  Node version that actually runs there, not the dev box's Node. Running
  deploy.ps1 on the server handles that.

.PARAMETER Target
  The deploy root on the mapped drive. Defaults to Z:\cabq-plan.

.PARAMETER SkipBuild
  Skip 'npm run build' - useful when re-pushing an already built dist\.

.EXAMPLE
  .\scripts\push-to-sandbox.ps1

.EXAMPLE
  .\scripts\push-to-sandbox.ps1 -Target Z:\cabq-plan -SkipBuild
#>

[CmdletBinding()]
param(
  [string]$Target = "Z:\cabq-plan",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Write-Step($m) { Write-Host ""; Write-Host "==> $m" -ForegroundColor Cyan }
function Write-Ok($m)   { Write-Host "    OK  $m" -ForegroundColor Green }
function Write-Err2($m) { Write-Host "    ERR $m" -ForegroundColor Red }

# ----------------------------------------------------------------------------
# Locate repo root (this script lives in scripts\)
# ----------------------------------------------------------------------------
$scriptDir = Split-Path -Parent $PSCommandPath
$repoRoot  = Split-Path -Parent $scriptDir
Set-Location $repoRoot
Write-Ok "repo  = $repoRoot"
Write-Ok "target = $Target"

if (-not (Test-Path $Target)) {
  Write-Err2 "Target path '$Target' is not accessible. Is the drive mapped?"
  exit 2
}

# ----------------------------------------------------------------------------
# Build
# ----------------------------------------------------------------------------
if ($SkipBuild) {
  Write-Step "Skipping build (-SkipBuild)"
} else {
  Write-Step "npm run build"
  & npm run build
  if ($LASTEXITCODE -ne 0) {
    Write-Err2 "Build failed (exit $LASTEXITCODE)"
    exit $LASTEXITCODE
  }
}

# ----------------------------------------------------------------------------
# Copy dist\  (SPA)
# ----------------------------------------------------------------------------
Write-Step "Mirroring dist\ -> $Target\dist"
$null = robocopy "$repoRoot\dist" "$Target\dist" /MIR /NFL /NDL /NJH /NJS /NC /NS
# robocopy uses 0-7 for success; 8+ is a failure.
if ($LASTEXITCODE -ge 8) { Write-Err2 "robocopy dist failed ($LASTEXITCODE)"; exit $LASTEXITCODE }
Write-Ok "dist mirrored"

# ----------------------------------------------------------------------------
# Copy server\  (TypeScript sources, no tests)
# ----------------------------------------------------------------------------
Write-Step "Mirroring server\ -> $Target\server"
$null = robocopy "$repoRoot\server" "$Target\server" /MIR /XF "*.test.ts" /NFL /NDL /NJH /NJS /NC /NS
if ($LASTEXITCODE -ge 8) { Write-Err2 "robocopy server failed ($LASTEXITCODE)"; exit $LASTEXITCODE }
Write-Ok "server mirrored"

# ----------------------------------------------------------------------------
# Copy manifest + ecosystem + deploy helper
# ----------------------------------------------------------------------------
Write-Step "Copying package manifests + ecosystem + deploy script"
Copy-Item "$repoRoot\package.json"          "$Target\package.json"          -Force
Copy-Item "$repoRoot\package-lock.json"     "$Target\package-lock.json"     -Force
Copy-Item "$repoRoot\ecosystem.config.cjs"  "$Target\ecosystem.config.cjs"  -Force

if (-not (Test-Path "$Target\scripts")) { New-Item -ItemType Directory -Path "$Target\scripts" | Out-Null }
Copy-Item "$repoRoot\scripts\deploy.ps1"    "$Target\scripts\deploy.ps1"    -Force
Write-Ok "manifest + ecosystem + deploy.ps1 copied"

# ----------------------------------------------------------------------------
# Done
# ----------------------------------------------------------------------------
Write-Host ""
Write-Host "Files are staged on $Target." -ForegroundColor Green
Write-Host ""
Write-Host "Next step - on the SERVER (D:\cabq-plan), run:" -ForegroundColor Yellow
Write-Host "  cd D:\cabq-plan"
Write-Host "  .\scripts\deploy.ps1"
Write-Host ""
Write-Host "That installs prod deps against the server's Node (rebuilds"
Write-Host "better-sqlite3), pm2-reloads the app, and probes /api/health."
