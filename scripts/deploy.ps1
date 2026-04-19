#requires -Version 5.1
<#
.SYNOPSIS
  Post-deploy runner for the CABQ Comprehensive Plan Action sandbox / prod.

.DESCRIPTION
  Run this on the server AFTER the dev box has copied a fresh dist\, server\,
  package.json, package-lock.json, and ecosystem.config.cjs into this folder.

  What it does, in order:
    1. Sanity-checks that it's running from the deploy folder (D:\cabq-plan).
    2. (Optional, default on) Runs 'npm install --omit=dev' so any new prod
       dependencies land AND every native module (better-sqlite3) is
       rebuilt against the Node version actually installed on THIS box.
       This is the step that prevents NODE_MODULE_VERSION mismatch crashes
       after a deploy from a workstation that runs a different Node version.
    3. (Optional) Runs 'npm rebuild better-sqlite3' explicitly if you only
       want the native rebuild and no dep-graph touches.
    4. Confirms ecosystem.config.cjs is present and has a recognisable
       PM2 app entry.
    5. Tells PM2 to reload cabq-plan-api with --update-env so the new
       ecosystem AND .env are re-read by the running process.
    6. Waits a moment and hits /api/health to confirm the server came up.
    7. Tails the last 40 lines of pm2 logs on failure.

.PARAMETER SkipInstall
  Don't run 'npm install --omit=dev'. Use this for a fast reload when you
  KNOW nothing changed in node_modules (e.g. .env edit only).

.PARAMETER RebuildNativeOnly
  Instead of 'npm install --omit=dev', only run 'npm rebuild better-sqlite3'.
  Faster than a full install; safe when no deps changed but you want to be
  sure the native binding matches the server's Node.

.PARAMETER HealthPort
  Port the API listens on. Default 8787 (matches ecosystem.config.cjs).

.PARAMETER NoHealthCheck
  Skip the post-reload HTTP health probe.

.EXAMPLE
  # Standard deploy after dev-box copy:
  .\scripts\deploy.ps1

.EXAMPLE
  # Fast .env-only reload (no dep or native changes):
  .\scripts\deploy.ps1 -SkipInstall

.EXAMPLE
  # Force a native rebuild after a Node upgrade on the server:
  .\scripts\deploy.ps1 -RebuildNativeOnly
#>

[CmdletBinding()]
param(
  [switch]$SkipInstall,
  [switch]$RebuildNativeOnly,
  [int]   $HealthPort = 8787,
  [switch]$NoHealthCheck
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Write-Ok($msg)   { Write-Host "    OK  $msg" -ForegroundColor Green }
function Write-Warn2($m)  { Write-Host "    WARN $m"  -ForegroundColor Yellow }
function Write-Err2($m)   { Write-Host "    ERR  $m"  -ForegroundColor Red }

# ----------------------------------------------------------------------------
# 1. Sanity checks
# ----------------------------------------------------------------------------
Write-Step "Verifying deploy folder"

$scriptDir  = Split-Path -Parent $PSCommandPath
$deployRoot = Split-Path -Parent $scriptDir      # .\scripts\deploy.ps1 -> repo root
Set-Location $deployRoot
Write-Ok "cwd = $deployRoot"

foreach ($required in @("package.json", "ecosystem.config.cjs", "server", "dist")) {
  if (-not (Test-Path (Join-Path $deployRoot $required))) {
    Write-Err2 "Missing '$required' in $deployRoot. Did the dev-box robocopy finish?"
    exit 2
  }
}
Write-Ok "package.json, ecosystem.config.cjs, server\, dist\ present"

# Warn if node_modules is missing entirely - we'd have to do a full install
# regardless of -SkipInstall in that case.
$nmPath = Join-Path $deployRoot "node_modules"
if (-not (Test-Path $nmPath)) {
  Write-Warn2 "node_modules\ not found - forcing full install."
  $SkipInstall        = $false
  $RebuildNativeOnly  = $false
}

# ----------------------------------------------------------------------------
# 2. Dependency / native step
# ----------------------------------------------------------------------------
if ($SkipInstall -and -not $RebuildNativeOnly) {
  Write-Step "Skipping npm install (-SkipInstall)"
}
elseif ($RebuildNativeOnly) {
  Write-Step "Rebuilding native modules against local Node"
  & npm rebuild better-sqlite3
  if ($LASTEXITCODE -ne 0) {
    Write-Err2 "npm rebuild better-sqlite3 failed (exit $LASTEXITCODE)"
    exit $LASTEXITCODE
  }
  Write-Ok "better-sqlite3 rebuilt"
}
else {
  Write-Step "Installing production dependencies (also rebuilds natives)"
  & npm install --omit=dev
  if ($LASTEXITCODE -ne 0) {
    Write-Err2 "npm install --omit=dev failed (exit $LASTEXITCODE)"
    exit $LASTEXITCODE
  }
  Write-Ok "npm install --omit=dev completed"
}

# Quick sanity: the tsx CLI must exist, otherwise PM2 will crash on start.
$tsxCli = Join-Path $deployRoot "node_modules\tsx\dist\cli.mjs"
if (-not (Test-Path $tsxCli)) {
  Write-Err2 "$tsxCli is missing. tsx must be a production dependency."
  Write-Err2 "Run 'npm install --save tsx' on the dev box, redeploy, re-run."
  exit 3
}
Write-Ok "tsx CLI present"

# ----------------------------------------------------------------------------
# 3. PM2 reload
# ----------------------------------------------------------------------------
Write-Step "Reloading PM2 app 'cabq-plan-api'"

# Verify pm2 is on PATH.
$pm2 = Get-Command pm2 -ErrorAction SilentlyContinue
if (-not $pm2) {
  Write-Err2 "pm2 is not on PATH in this shell. Open an Administrator PowerShell or run pm2 directly."
  exit 4
}

& pm2 reload ecosystem.config.cjs --update-env --env production
if ($LASTEXITCODE -ne 0) {
  Write-Warn2 "pm2 reload returned $LASTEXITCODE - app may not have been running. Trying 'pm2 start'..."
  & pm2 start ecosystem.config.cjs --env production
  if ($LASTEXITCODE -ne 0) {
    Write-Err2 "pm2 start also failed (exit $LASTEXITCODE)"
    & pm2 logs cabq-plan-api --lines 40 --nostream
    exit $LASTEXITCODE
  }
}
Write-Ok "PM2 reload issued"

# Persist process list across reboots.
& pm2 save | Out-Null

# ----------------------------------------------------------------------------
# 4. Health check
# ----------------------------------------------------------------------------
if ($NoHealthCheck) {
  Write-Step "Skipping health check (-NoHealthCheck)"
  Write-Host ""
  Write-Host "Deploy complete." -ForegroundColor Green
  exit 0
}

Write-Step "Waiting for API to come up on port $HealthPort"

$healthUrl = "http://127.0.0.1:$HealthPort/api/health"
$deadline  = (Get-Date).AddSeconds(20)
$healthy   = $false

while ((Get-Date) -lt $deadline) {
  try {
    $r = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) {
      $healthy = $true
      Write-Ok "GET $healthUrl -> 200"
      Write-Host "    $($r.Content)"
      break
    }
  } catch {
    Start-Sleep -Milliseconds 750
  }
}

if (-not $healthy) {
  Write-Err2 "API did not respond on $healthUrl within 20s."
  Write-Err2 "Last 40 lines of pm2 logs:"
  & pm2 logs cabq-plan-api --lines 40 --nostream
  exit 5
}

# Optionally verify the v3.6+ auth config endpoint so we're sure the new code
# is running (the OLD build 404s this).
try {
  $a = Invoke-WebRequest -Uri "http://127.0.0.1:$HealthPort/api/auth/config" -UseBasicParsing -TimeoutSec 3
  if ($a.StatusCode -eq 200) {
    Write-Ok "GET /api/auth/config -> 200 (new build is live)"
  }
} catch {
  Write-Warn2 "/api/auth/config did not return 200 - the running build may still be stale."
}

Write-Host ""
Write-Host "Deploy complete." -ForegroundColor Green
