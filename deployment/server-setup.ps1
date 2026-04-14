<#
.SYNOPSIS
  One-time setup for DTIAPPSINTDEV or DTIAPPSINTPRD.
  Installs Git, Node.js 22, PM2, IIS + ARR + URL Rewrite, creates app
  directories, and sets required system environment variables.

.PARAMETER Environment
  "dev"  - sets URLs/paths appropriate for DTIAPPSINTDEV
  "prod" - sets URLs/paths appropriate for DTIAPPSINTPRD

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File server-setup.ps1 -Environment dev
  powershell -ExecutionPolicy Bypass -File server-setup.ps1 -Environment prod

.NOTES
  Tested on Windows Server 2022 Standard.
  Run as Administrator.  Internet access required.
  Idempotent - safe to re-run.
#>

#Requires -RunAsAdministrator

param(
  [ValidateSet("dev", "prod")]
  [string]$Environment = "dev"
)

$ErrorActionPreference = "Stop"
$ProgressPreference    = "SilentlyContinue"

Write-Host "=== Server Setup ($($Environment.ToUpper())) ===" -ForegroundColor Cyan

# ── Helper: refresh PATH from registry ────────────────────────────────────────
function Refresh-Path {
  $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath    = [System.Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path    = "$machinePath;$userPath"
}

# ══════════════════════════════════════════════════════════════════════════════
# 1. OpenSSH Server
# ══════════════════════════════════════════════════════════════════════════════
Write-Host "`n[1/9] Enabling OpenSSH Server..." -ForegroundColor Yellow

$sshCap = Get-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
if ($sshCap.State -ne "Installed") {
  try {
    Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0 | Out-Null
    Write-Host "  OpenSSH Server installed."
  } catch {
    Write-Host "  ERROR: Add-WindowsCapability failed." -ForegroundColor Red
    Write-Host "  This usually means Windows Update / WSUS is unreachable." -ForegroundColor Red
    Write-Host "  Alternative: Mount the Server FOD ISO and run:" -ForegroundColor Yellow
    Write-Host "    dism /Online /Add-Capability /CapabilityName:OpenSSH.Server~~~~0.0.1.0 /Source:E:\sources\sxs" -ForegroundColor Yellow
    throw $_
  }
} else {
  Write-Host "  OpenSSH Server already installed."
}

Start-Service sshd -ErrorAction SilentlyContinue
Set-Service -Name sshd -StartupType Automatic

if (-not (Get-NetFirewallRule -Name "OpenSSH-Server-In-TCP" -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -Name "OpenSSH-Server-In-TCP" `
    -DisplayName "OpenSSH Server (sshd)" `
    -Enabled True -Direction Inbound -Protocol TCP `
    -Action Allow -LocalPort 22 | Out-Null
  Write-Host "  Firewall rule added (port 22)."
}

# ══════════════════════════════════════════════════════════════════════════════
# 2. Git for Windows
# ══════════════════════════════════════════════════════════════════════════════
Write-Host "`n[2/9] Installing Git for Windows..." -ForegroundColor Yellow

if (Get-Command git -ErrorAction SilentlyContinue) {
  Write-Host "  Git already installed: $(git --version)"
} else {
  $gitVersion   = "2.47.1"
  $gitInstaller = "$env:TEMP\Git-$gitVersion-64-bit.exe"
  $gitUrl       = "https://github.com/git-for-windows/git/releases/download/v$gitVersion.windows.1/Git-$gitVersion-64-bit.exe"

  if (-not (Test-Path $gitInstaller)) {
    Write-Host "  Downloading Git $gitVersion..."
    Invoke-WebRequest -Uri $gitUrl -OutFile $gitInstaller -UseBasicParsing
  }

  Write-Host "  Installing Git $gitVersion (silent)..."
  Start-Process $gitInstaller -ArgumentList `
    "/VERYSILENT /NORESTART /NOCANCEL /SP- /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS /COMPONENTS=icons,ext\reg\shellhere,assoc,assoc_sh" `
    -Wait

  Refresh-Path
  Write-Host "  Git installed: $(git --version)"
}

# ══════════════════════════════════════════════════════════════════════════════
# 3. Node.js v22 LTS via MSI
# ══════════════════════════════════════════════════════════════════════════════
Write-Host "`n[3/9] Installing Node.js v22 LTS..." -ForegroundColor Yellow

if (Get-Command node -ErrorAction SilentlyContinue) {
  Write-Host "  Node.js already installed: $(node --version)"
} else {
  $nodeVersion = "v22.16.0"
  $nodeMsi     = "$env:TEMP\node-$nodeVersion-x64.msi"
  $nodeUrl     = "https://nodejs.org/dist/$nodeVersion/node-$nodeVersion-x64.msi"

  if (-not (Test-Path $nodeMsi)) {
    Write-Host "  Downloading Node.js $nodeVersion..."
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeMsi -UseBasicParsing
  }

  Write-Host "  Installing Node.js $nodeVersion (silent)..."
  Start-Process msiexec.exe -ArgumentList "/i `"$nodeMsi`" /quiet /norestart" -Wait

  Refresh-Path
}

Write-Host "  Node: $(node --version)  npm: $(npm --version)"

# ══════════════════════════════════════════════════════════════════════════════
# 4. PM2 (global npm tool)
# ══════════════════════════════════════════════════════════════════════════════
Write-Host "`n[4/9] Installing PM2..." -ForegroundColor Yellow

npm install -g pm2 pm2-windows-startup 2>&1 | Out-Null
Write-Host "  PM2: $(pm2 --version)"

# Register PM2 as a Windows service so processes survive reboots
$ErrorActionPreference = "Continue"
pm2-startup install 2>&1 | Out-Null
$ErrorActionPreference = "Stop"

# Verify the service was created
$pm2Svc = Get-Service -Name "*pm2*" -ErrorAction SilentlyContinue
if ($pm2Svc) {
  Write-Host "  PM2 Windows service registered: $($pm2Svc.Name) ($($pm2Svc.Status))"
} else {
  Write-Host "  WARNING: PM2 Windows service was NOT created." -ForegroundColor Red
  Write-Host "  PM2 processes will not survive a reboot." -ForegroundColor Red
  Write-Host "  Consider using NSSM as an alternative:" -ForegroundColor Yellow
  Write-Host "    nssm install PM2 node.exe <npm-global>/pm2/bin/pm2 resurrect" -ForegroundColor Yellow
}

# ══════════════════════════════════════════════════════════════════════════════
# 5. IIS (Windows Server role)
# ══════════════════════════════════════════════════════════════════════════════
Write-Host "`n[5/9] Installing IIS features..." -ForegroundColor Yellow

$iisResult = Install-WindowsFeature -Name `
  Web-Server, `
  Web-WebServer, `
  Web-Common-Http, `
  Web-Static-Content, `
  Web-Default-Doc, `
  Web-Dir-Browsing, `
  Web-Http-Errors, `
  Web-Stat-Compression, `
  Web-Mgmt-Console, `
  Web-Mgmt-Service `
  -IncludeManagementTools

if ($iisResult.RestartNeeded -eq "Yes") {
  Write-Host "  IIS installed but a REBOOT IS REQUIRED." -ForegroundColor Red
  Write-Host "  Restart the server and re-run this script to continue." -ForegroundColor Red
  Write-Host "  (Steps already completed will be skipped.)" -ForegroundColor Yellow
  exit 1
}

Write-Host "  IIS features installed."

# ══════════════════════════════════════════════════════════════════════════════
# 6. ARR 3.0 + URL Rewrite 2.1 (direct MSI — WebPI is EOL)
# ══════════════════════════════════════════════════════════════════════════════
Write-Host "`n[6/9] Installing ARR + URL Rewrite..." -ForegroundColor Yellow

# URL Rewrite 2.1 must be installed BEFORE ARR 3.0
$rewriteMsi = "$env:TEMP\rewrite_amd64.msi"
$rewriteUrl = "https://download.microsoft.com/download/1/2/8/128E2E22-C1B9-44A4-BE2A-5859ED1D4592/rewrite_amd64_en-US.msi"

if (-not (Test-Path $rewriteMsi)) {
  Write-Host "  Downloading URL Rewrite 2.1..."
  Invoke-WebRequest -Uri $rewriteUrl -OutFile $rewriteMsi -UseBasicParsing
}
Write-Host "  Installing URL Rewrite 2.1..."
Start-Process msiexec.exe -ArgumentList "/i `"$rewriteMsi`" /quiet /norestart" -Wait

# ARR 3.0
$arrMsi = "$env:TEMP\requestRouter_amd64.msi"
$arrUrl = "https://download.microsoft.com/download/E/9/8/E9849D6A-020E-47E4-9FD0-A023E99B54EB/requestRouter_amd64.msi"

if (-not (Test-Path $arrMsi)) {
  Write-Host "  Downloading ARR 3.0..."
  Invoke-WebRequest -Uri $arrUrl -OutFile $arrMsi -UseBasicParsing
}
Write-Host "  Installing ARR 3.0..."
Start-Process msiexec.exe -ArgumentList "/i `"$arrMsi`" /quiet /norestart" -Wait

# IIS must be restarted for ARR schema extensions to register
Write-Host "  Restarting IIS to register ARR schema..."
iisreset /restart | Out-Null
Start-Sleep -Seconds 5

# Enable ARR reverse proxy globally
Import-Module WebAdministration -Force
Set-WebConfigurationProperty `
  -Filter "system.webServer/proxy" -Name "enabled" -Value "True" -PSPath "IIS:\"
Write-Host "  ARR proxy enabled."

# ══════════════════════════════════════════════════════════════════════════════
# 7. App directories (includes dist/ dirs for IIS physical paths)
# ══════════════════════════════════════════════════════════════════════════════
Write-Host "`n[7/9] Creating app directories..." -ForegroundColor Yellow

$dirs = @(
  "D:\cabq-plan",
  "D:\cabq-plan\dist",                    # IIS physical path - must exist before site creation
  "D:\call-pat",
  "D:\call-pat\apps\web-admin\dist",      # IIS physical path - must exist before site creation
  "D:\call-pat\packages\api\data"          # SQLite data dir (current); keep when migrating to MSSQL
)
foreach ($d in $dirs) {
  New-Item -ItemType Directory -Force -Path $d | Out-Null
  Write-Host "  $d"
}

# ══════════════════════════════════════════════════════════════════════════════
# 8. IIS sites + firewall rules
# ══════════════════════════════════════════════════════════════════════════════
Write-Host "`n[8/9] Configuring IIS sites..." -ForegroundColor Yellow

Import-Module WebAdministration -Force

# Stop Default Web Site to free port 80 (optional)
if (Get-Website -Name "Default Web Site" -ErrorAction SilentlyContinue) {
  Stop-Website -Name "Default Web Site"
}

# CABQ Plan - port 8080
if (-not (Get-Website -Name "cabq-plan" -ErrorAction SilentlyContinue)) {
  New-WebSite -Name "cabq-plan" -Port 8080 `
    -PhysicalPath "D:\cabq-plan\dist" -Force | Out-Null
  Write-Host "  Created site: cabq-plan (port 8080)"
} else {
  Write-Host "  Site already exists: cabq-plan"
}

# Call Pat - port 8090
if (-not (Get-Website -Name "call-pat" -ErrorAction SilentlyContinue)) {
  New-WebSite -Name "call-pat" -Port 8090 `
    -PhysicalPath "D:\call-pat\apps\web-admin\dist" -Force | Out-Null
  Write-Host "  Created site: call-pat (port 8090)"
} else {
  Write-Host "  Site already exists: call-pat"
}

# Firewall rules (idempotent - checks by name before creating)
foreach ($port in @(8080, 8090)) {
  $ruleName = "App-Port-$port-In-TCP"
  if (-not (Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -Name $ruleName -DisplayName "App Port $port" `
      -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow | Out-Null
    Write-Host "  Firewall rule added: port $port"
  }
}

# ══════════════════════════════════════════════════════════════════════════════
# 9. System environment variables
# ══════════════════════════════════════════════════════════════════════════════
Write-Host "`n[9/9] Setting system environment variables..." -ForegroundColor Yellow

# DATABASE_URL ─────────────────────────────────────────────────────────────────
# CURRENT: SQLite (file-based)
$dbUrl = "file:D:/call-pat/packages/api/data/callpat.db"
#
# FUTURE - MS SQL Server migration:
#   Change this value to your SQL Server connection string:
#   $dbUrl = "sqlserver://MSSQL_SERVER\INSTANCE;database=CallPat;encrypt=true;trustServerCertificate=false"
#
#   Also update the Call Pat app code:
#     1. npm install mssql  /  npm uninstall better-sqlite3  (in packages/api)
#     2. Update packages/api/src/db/index.ts   (drizzle-orm/mssql driver)
#     3. Update packages/api/drizzle.config.ts  (dialect: "mssql")
#     4. Update packages/api/src/db/schema.ts   (mssqlTable from drizzle-orm/mssql-core)
#     5. Update DATABASE_URL secret in GitHub Actions
#     6. Run npm run db:push once against the new SQL Server
#
[System.Environment]::SetEnvironmentVariable("DATABASE_URL", $dbUrl, "Machine")
Write-Host "  DATABASE_URL = $dbUrl"

# VITE_API_URL (baked into Call Pat web admin at build time) ───────────────────
if ($Environment -eq "dev") {
  $viteApiUrl = "http://DTIAPPSINTDEV:8090"
} else {
  $viteApiUrl = "http://call-pat.dtiappsintprd.local"
}
[System.Environment]::SetEnvironmentVariable("VITE_API_URL", $viteApiUrl, "Machine")
Write-Host "  VITE_API_URL = $viteApiUrl"

# ── MS SQL Server ODBC Driver 18 (FUTURE - uncomment when migrating) ─────────
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
  1. Clone repos into D:\ using deploy keys:
       git clone git@github.com:dpiersol/cabq-comprehensive-plan-action-app.git D:\cabq-plan
       git clone git@github.com:dpiersol/call-pat-prototype.git D:\call-pat

  2. On DEV, check out the develop branch in each clone:
       cd D:\cabq-plan  && git checkout develop
       cd D:\call-pat   && git checkout develop

  3. Add the server's SSH public key to GitHub as a Deploy Key (read-only) for each repo.
       cat C:\Users\$env:USERNAME\.ssh\id_ed25519.pub

  4. Generate a separate keypair for GitHub Actions -> this server (Actions SSH key):
       ssh-keygen -t ed25519 -C "github-actions-deploy" -f github_actions_deploy
     Add the PUBLIC key to C:\Users\a25347\.ssh\authorized_keys on this server.
     Add the PRIVATE key as a GitHub Secret (DEV_SSH_KEY or PROD_SSH_KEY).

  5. Set these GitHub Secrets in each repo (Settings -> Secrets -> Actions):
       DEV_SSH_HOST  = DTIAPPSINTDEV
       DEV_SSH_USER  = a25347
       DEV_SSH_KEY   = <private key from step 4>
       PROD_SSH_HOST = DTIAPPSINTPRD
       PROD_SSH_USER = a25347
       PROD_SSH_KEY  = <private key for PROD server>

  6. Set up GitHub Environments (Settings -> Environments):
       Create "development"  - no required reviewers
       Create "production"   - add required reviewers (the approval gate)

  7. Protect the master/main branch (Settings -> Branches -> Add rule):
       Require a pull request before merging
       Require status checks: develop, qa-check, security-check

  8. Push to develop branch to trigger the first DEV deployment.
"@
