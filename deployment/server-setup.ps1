<#
.SYNOPSIS
  One-time setup for DTIAPPSINTDEV or DTIAPPSINTPRD.
  Installs Node.js 22, PM2, IIS + ARR + URL Rewrite, creates app directories,
  and sets required system environment variables.

.PARAMETER Environment
  "dev"  – sets URLs/paths appropriate for DTIAPPSINTDEV
  "prod" – sets URLs/paths appropriate for DTIAPPSINTPRD

.EXAMPLE
  # On DEV server (run as Administrator):
  powershell -ExecutionPolicy Bypass -File server-setup.ps1 -Environment dev

  # On PROD server (run as Administrator):
  powershell -ExecutionPolicy Bypass -File server-setup.ps1 -Environment prod

.NOTES
  Requires Windows Server 2019 or 2022.
  Run as Administrator.
  Internet access required (winget, npm, Microsoft downloads).
#>

#Requires -RunAsAdministrator

param(
  [ValidateSet("dev", "prod")]
  [string]$Environment = "dev"
)

$ErrorActionPreference = "Stop"
$ProgressPreference    = "SilentlyContinue"

Write-Host "=== Server Setup ($($Environment.ToUpper())) ===" -ForegroundColor Cyan

# ── 1. OpenSSH Server ─────────────────────────────────────────────────────────
Write-Host "`n[1/8] Enabling OpenSSH Server..." -ForegroundColor Yellow

$sshCap = Get-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
if ($sshCap.State -ne "Installed") {
  Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0 | Out-Null
}
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic

if (-not (Get-NetFirewallRule -Name "OpenSSH-Server-In-TCP" -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -Name "OpenSSH-Server-In-TCP" `
    -DisplayName "OpenSSH Server (sshd)" `
    -Enabled True -Direction Inbound -Protocol TCP `
    -Action Allow -LocalPort 22 | Out-Null
  Write-Host "  Firewall rule added for SSH (port 22)"
}

# ── 2. Node.js v22 LTS via MSI installer ──────────────────────────────────────
Write-Host "`n[2/8] Installing Node.js v22 LTS..." -ForegroundColor Yellow

$nodeVersion = "v22.16.0"
$nodeMsi = "$env:TEMP\node-$nodeVersion-x64.msi"
$nodeUrl = "https://nodejs.org/dist/$nodeVersion/node-$nodeVersion-x64.msi"

if (-not (Test-Path $nodeMsi)) {
  Write-Host "  Downloading Node.js $nodeVersion..."
  Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeMsi -UseBasicParsing
}

Write-Host "  Installing Node.js $nodeVersion (silent)..."
Start-Process msiexec.exe -ArgumentList "/i `"$nodeMsi`" /quiet /norestart" -Wait

# Refresh PATH for this session so node/npm are available immediately
$machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
$userPath    = [System.Environment]::GetEnvironmentVariable("Path", "User")
$env:Path    = "$machinePath;$userPath"

Write-Host "  Node: $(node --version)  npm: $(npm --version)"

# ── 3. Global npm tools ───────────────────────────────────────────────────────
Write-Host "`n[3/8] Installing PM2 and pm2-windows-startup..." -ForegroundColor Yellow

npm install -g pm2 pm2-windows-startup
pm2-startup install
Write-Host "  PM2: $(pm2 --version)"

# ── 4. IIS features ───────────────────────────────────────────────────────────
Write-Host "`n[4/8] Enabling IIS features..." -ForegroundColor Yellow

$features = @(
  "IIS-WebServerRole", "IIS-WebServer", "IIS-CommonHttpFeatures",
  "IIS-StaticContent", "IIS-DefaultDocument", "IIS-DirectoryBrowsing",
  "IIS-HttpErrors", "IIS-HttpCompressionStatic", "IIS-ManagementConsole",
  "IIS-ManagementService"
)
foreach ($f in $features) {
  Enable-WindowsOptionalFeature -Online -FeatureName $f `
    -NoRestart -WarningAction SilentlyContinue | Out-Null
}
Write-Host "  IIS core features enabled."

# ── 5. ARR 3.0 + URL Rewrite 2.1 via Web Platform Installer ──────────────────
Write-Host "`n[5/8] Installing ARR + URL Rewrite via Web Platform Installer..." -ForegroundColor Yellow

$wpiMsi = "$env:TEMP\WebPlatformInstaller_amd64_en-US.msi"
if (-not (Test-Path $wpiMsi)) {
  # Web Platform Installer download – verify URL at https://www.iis.net/downloads/microsoft/web-platform-installer
  $wpiUrl = "https://download.microsoft.com/download/C/F/F/CFF3A0B8-99D4-41A2-AE1A-496C08BEB904/WebPlatformInstaller_amd64_en-US.msi"
  Invoke-WebRequest -Uri $wpiUrl -OutFile $wpiMsi -UseBasicParsing
}
Start-Process msiexec.exe -ArgumentList "/i `"$wpiMsi`" /quiet /norestart" -Wait

$webpicmd = "${env:ProgramFiles}\Microsoft\Web Platform Installer\WebpiCmd-x64.exe"
& $webpicmd /Install /Products:UrlRewrite2,ARRv3_0 /AcceptEula /SuppressPostFinish

# Enable ARR reverse proxy globally
Import-Module WebAdministration
Set-WebConfigurationProperty `
  -Filter "system.webServer/proxy" -Name "enabled" -Value "True" -PSPath "IIS:\"
Write-Host "  ARR proxy enabled."

# ── 6. App directories ────────────────────────────────────────────────────────
Write-Host "`n[6/8] Creating app directories..." -ForegroundColor Yellow

$dirs = @(
  "D:\cabq-plan",
  "D:\call-pat",
  "D:\call-pat\packages\api\data"   # SQLite data dir (current); keep when migrating to MSSQL
)
foreach ($d in $dirs) {
  New-Item -ItemType Directory -Force -Path $d | Out-Null
  Write-Host "  $d"
}

# ── 7. IIS sites ──────────────────────────────────────────────────────────────
Write-Host "`n[7/8] Configuring IIS sites..." -ForegroundColor Yellow

Import-Module WebAdministration

# Stop Default Web Site to free port 80 (optional – comment out if needed)
if (Get-Website -Name "Default Web Site" -ErrorAction SilentlyContinue) {
  Stop-Website -Name "Default Web Site"
}

# CABQ Plan – port 8080
if (-not (Get-Website -Name "cabq-plan" -ErrorAction SilentlyContinue)) {
  New-WebSite -Name "cabq-plan" -Port 8080 `
    -PhysicalPath "D:\cabq-plan\dist" -Force | Out-Null
  Write-Host "  Created: cabq-plan (port 8080)"
}

# Call Pat – port 8090
if (-not (Get-Website -Name "call-pat" -ErrorAction SilentlyContinue)) {
  New-WebSite -Name "call-pat" -Port 8090 `
    -PhysicalPath "D:\call-pat\apps\web-admin\dist" -Force | Out-Null
  Write-Host "  Created: call-pat (port 8090)"
}

# Firewall rules for app ports
foreach ($port in @(8080, 8090)) {
  New-NetFirewallRule -DisplayName "App Port $port" `
    -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow `
    -ErrorAction SilentlyContinue | Out-Null
}
Write-Host "  Firewall rules added for ports 8080, 8090."

# ── 8. System environment variables ──────────────────────────────────────────
Write-Host "`n[8/8] Setting system environment variables..." -ForegroundColor Yellow

# ── Call Pat – DATABASE_URL ───────────────────────────────────────────────────
# CURRENT: SQLite (file-based)
#   file:C:/apps/call-pat/packages/api/data/callpat.db
#
# FUTURE – MS SQL Server migration:
#   When the app code is updated to use Drizzle's mssql driver, change this to:
#   sqlserver://MSSQL_SERVER\INSTANCE;database=CallPat;encrypt=true;trustServerCertificate=false
#
#   Also:
#     1. Install MSSQL ODBC Driver 18 (section below)
#     2. In call-pat repo:
#          npm install mssql
#          npm uninstall better-sqlite3
#          Update packages/api/src/db/index.ts  (drizzle-orm/mssql)
#          Update packages/api/drizzle.config.ts (dialect: "mssql")
#          Update packages/api/src/db/schema.ts  (mssqlTable from drizzle-orm/mssql-core)
#     3. Update DATABASE_URL secret in GitHub Actions
#     4. Run db:push once against the new SQL Server
#
$dbUrl = "file:D:/call-pat/packages/api/data/callpat.db"
[System.Environment]::SetEnvironmentVariable("DATABASE_URL", $dbUrl, "Machine")
Write-Host "  DATABASE_URL = $dbUrl"

# ── Call Pat – VITE_API_URL (baked into web admin at build time) ──────────────
# This must be set on the server because the app is built on the server during deploy.
if ($Environment -eq "dev") {
  $viteApiUrl = "http://DTIAPPSINTDEV:8090"
} else {
  $viteApiUrl = "http://call-pat.dtiappsintprd.local"
}
[System.Environment]::SetEnvironmentVariable("VITE_API_URL", $viteApiUrl, "Machine")
Write-Host "  VITE_API_URL = $viteApiUrl"

# ── MS SQL Server ODBC Driver 18 (FUTURE – uncomment when migrating) ──────────
#
# Write-Host "`nInstalling MS SQL ODBC Driver 18..." -ForegroundColor Yellow
# $odbcMsi = "$env:TEMP\msodbcsql18.msi"
# # Verify URL at https://learn.microsoft.com/sql/connect/odbc/download-odbc-driver-for-sql-server
# $odbcUrl = "https://go.microsoft.com/fwlink/?linkid=2249004"
# Invoke-WebRequest -Uri $odbcUrl -OutFile $odbcMsi -UseBasicParsing
# Start-Process msiexec.exe `
#   -ArgumentList "/i `"$odbcMsi`" /quiet /norestart IACCEPTMSODBCSQLLICENSETERMS=YES" -Wait
# Write-Host "  ODBC Driver 18 installed."

Write-Host "`n=== Setup complete! ===" -ForegroundColor Green
Write-Host @"

Next steps:
  1. Clone repos into D:\ using a deploy key:
       git clone git@github.com:dpiersol/cabq-comprehensive-plan-action-app.git D:\cabq-plan
       git clone git@github.com:dpiersol/call-pat-prototype.git D:\call-pat

  2. On DEV clone, check out the develop branch:
       cd D:\cabq-plan  && git checkout develop
       cd D:\call-pat   && git checkout develop

  3. Add the server's SSH public key to GitHub as a Deploy Key (read-only) for each repo.
       cat C:\Users\$env:USERNAME\.ssh\id_ed25519.pub

  4. Generate a separate keypair for GitHub Actions → this server (Actions SSH key):
       ssh-keygen -t ed25519 -C "github-actions-deploy" -f github_actions_deploy
     Add the PUBLIC key to C:\Users\a25347\.ssh\authorized_keys on this server.
     Add the PRIVATE key as a GitHub Secret (DEV_SSH_KEY or PROD_SSH_KEY).

  5. Set these GitHub Secrets in each repo (Settings → Secrets → Actions):
       DEV_SSH_HOST  = DTIAPPSINTDEV
       DEV_SSH_USER  = a25347
       DEV_SSH_KEY   = <private key from step 4>
       PROD_SSH_HOST = DTIAPPSINTPRD
       PROD_SSH_USER = a25347
       PROD_SSH_KEY  = <private key for PROD server>

  6. Set up GitHub Environments (Settings → Environments):
       Create "development"  – no required reviewers
       Create "production"   – add required reviewers (the approval gate)

  7. Protect the master/main branch (Settings → Branches → Add rule):
       Require a pull request before merging
       Require status checks: develop, qa-check, security-check

  8. Push to develop branch to trigger the first DEV deployment.
"@
