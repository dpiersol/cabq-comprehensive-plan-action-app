# Manual Deployment Guide — CABQ Comprehensive Plan Action App

This guide covers deploying the app to **DTIAPPSINTDEV** (or PROD) **without** using the GitHub Actions CI/CD pipeline. Use this when SSH/CI is broken, for the very first deploy, or for emergency patches.

**Target server paths:**
- App root: `D:\cabq-plan`
- IIS physical path: `D:\cabq-plan\dist`
- API runs on port **8787** (PM2 process `cabq-plan-api`)
- IIS serves on port **8080** and reverse-proxies `/api/*` to 8787

---

## PHASE 1: One-Time Server Prep

Only do this once per server. Skip if Node/IIS/ARR are already installed.

### 1a. RDP to the server
```
mstsc /v:DTIAPPSINTDEV
```
Log in as a user with admin rights.

### 1b. Install prerequisites (Admin PowerShell on the server)

**Node.js 22 LTS** — download and double-click to install (accept defaults):
https://nodejs.org/dist/v22.16.0/node-v22.16.0-x64.msi

**PM2:**
```powershell
npm install -g pm2 pm2-windows-startup tsx
pm2-startup install
```
> `tsx` is installed globally so PM2 can run TypeScript server code directly.

**IIS + management tools:**
```powershell
Install-WindowsFeature Web-Server, Web-Static-Content, Web-Default-Doc, Web-Http-Errors, Web-Stat-Compression, Web-Mgmt-Console -IncludeManagementTools
```

**URL Rewrite 2.1** (install BEFORE ARR):
https://download.microsoft.com/download/1/2/8/128E2E22-C1B9-44A4-BE2A-5859ED1D4592/rewrite_amd64_en-US.msi

**ARR 3.0:**
https://download.microsoft.com/download/E/9/8/E9849D6A-020E-47E4-9FD0-A023E99B54EB/requestRouter_amd64.msi

**Restart IIS and enable ARR reverse-proxy:**
```powershell
iisreset /restart
Import-Module WebAdministration
Set-WebConfigurationProperty -Filter "system.webServer/proxy" -Name "enabled" -Value "True" -PSPath "IIS:\"
```

**Create app folders:**
```powershell
New-Item -ItemType Directory -Force -Path D:\cabq-plan
New-Item -ItemType Directory -Force -Path D:\cabq-plan\dist
```

**Open firewall port 8080:**
```powershell
New-NetFirewallRule -Name "App-Port-8080-In-TCP" -DisplayName "App Port 8080" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
```

---

## PHASE 2: Build the App Locally (on your workstation)

```powershell
cd C:\Users\e25347\CABQ-Comprehensive-Plan-Action-App
npm install
npm run build
```

This produces `dist/` — the React static files + `web.config`. The server code (`server/*.ts`) is **not** compiled; it runs directly via `tsx`.

---

## PHASE 3: Copy Files to the Server

### 3a. Map a drive to the server
```powershell
net use Z: \\DTIAPPSINTDEV\D$ /persistent:no
```
> If the `D$` admin share is blocked, have infra create a normal share on `D:\cabq-plan`.

### 3b. Copy files with robocopy (from your workstation)

```powershell
cd C:\Users\e25347\CABQ-Comprehensive-Plan-Action-App

# Built React app + web.config (IIS physical path)
robocopy dist Z:\cabq-plan\dist /MIR /NFL /NDL

# API source (runs directly via tsx)
robocopy server Z:\cabq-plan\server /MIR /NFL /NDL

# Runtime data and static assets
robocopy data   Z:\cabq-plan\data   /MIR /NFL /NDL
robocopy public Z:\cabq-plan\public /MIR /NFL /NDL

# Config and manifest files
copy package.json        Z:\cabq-plan\
copy package-lock.json   Z:\cabq-plan\
copy ecosystem.config.cjs Z:\cabq-plan\
copy tsconfig.json       Z:\cabq-plan\
copy tsconfig.server.json Z:\cabq-plan\
```

**DO NOT copy `node_modules` across the network** — it's slow and breaks native modules. Install on the server instead (Phase 4a).

### 3c. Disconnect the drive
```powershell
net use Z: /delete
```

---

## PHASE 4: Finish Setup on the Server

RDP to DTIAPPSINTDEV and open PowerShell as Administrator.

### 4a. Install dependencies on the server

For **dev server** (includes devDependencies so `tsx` is available locally):
```powershell
cd D:\cabq-plan
npm install
```

For **prod server** (only if `tsx` is installed globally):
```powershell
cd D:\cabq-plan
npm install --omit=dev
```

### 4b. Verify `ecosystem.config.cjs` is correct

The file should look like this (NOT pointing to `dist/index.js`):

```javascript
module.exports = {
  apps: [
    {
      name: "cabq-plan-api",
      script: "server/index.ts",
      interpreter: "node",
      interpreter_args: "--import tsx",
      cwd: "D:/cabq-plan",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env_development: {
        NODE_ENV: "development",
        PORT: "8787",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: "8787",
      },
    },
  ],
};
```

Verify it has the right `script` field:
```powershell
Get-Content D:\cabq-plan\ecosystem.config.cjs | Select-String "script"
```
Should show `script: "server/index.ts"`.

### 4c. Start the API with PM2

**On DEV:**
```powershell
cd D:\cabq-plan
pm2 delete all 2>$null
pm2 start ecosystem.config.cjs --env development
pm2 save
```

**On PROD:**
```powershell
cd D:\cabq-plan
pm2 delete all 2>$null
pm2 start ecosystem.config.cjs --env production
pm2 save
```

Verify it's running:
```powershell
pm2 list
pm2 logs cabq-plan-api --lines 30
```

You should see Fastify listening on port 8787.

### 4d. Create the IIS site (first time only)

**GUI method** — Open IIS Manager (`inetmgr`):
1. Right-click **Sites** → **Add Website**
2. **Site name:** `cabq-plan`
3. **Physical path:** `D:\cabq-plan\dist`
4. **Binding:** http, **All Unassigned**, port **8080**, host name blank
5. Click **OK**

**PowerShell method:**
```powershell
Import-Module WebAdministration
New-WebSite -Name "cabq-plan" -Port 8080 -PhysicalPath "D:\cabq-plan\dist" -Force
```

### 4e. Verify `web.config` is deployed
```powershell
Test-Path D:\cabq-plan\dist\web.config
```
If `False`, copy `public\web.config` into `dist\` manually. It's required for IIS to reverse-proxy `/api/*` to Node.

### 4f. Smoke test

**On the server:**
- http://localhost:8080 → React app loads
- http://localhost:8080/api/health → JSON response from Fastify

**From your workstation:**
- http://DTIAPPSINTDEV:8080

---

## File Layout on Server

```
D:\cabq-plan\
├── dist\                  ← IIS serves this (React + web.config)
│   ├── index.html
│   ├── assets\
│   └── web.config
├── server\                ← API TypeScript source (run by tsx)
│   └── index.ts
├── data\                  ← runtime data files
├── public\                ← static assets (source copy)
├── node_modules\          ← installed on server
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.server.json
└── ecosystem.config.cjs   ← PM2 config
```

---

## Future Updates (after first deploy)

On your workstation:
```powershell
cd C:\Users\e25347\CABQ-Comprehensive-Plan-Action-App
npm run build
net use Z: \\DTIAPPSINTDEV\D$
robocopy dist   Z:\cabq-plan\dist   /MIR /NFL /NDL
robocopy server Z:\cabq-plan\server /MIR /NFL /NDL
net use Z: /delete
```

On the server (only if server code changed):
```powershell
pm2 reload cabq-plan-api
```

IIS picks up `dist/` changes automatically — no reload needed for frontend-only updates.

---

## Troubleshooting

### `[PM2][ERROR] Script not found: D:\cabq-plan\dist\index.js`
PM2 is reading an old `ecosystem.config.cjs` that still points to `dist/index.js`. The server code is NEVER compiled to `dist/index.js` — it runs directly from `server/index.ts` via `tsx`.

Fix:
1. Update `ecosystem.config.cjs` per section **4b** above.
2. `pm2 delete all` to clear PM2's cached process.
3. `pm2 start ecosystem.config.cjs --env development` to reload.

### `[PM2][ERROR] tsx: command not found` or similar
`tsx` isn't installed. Run either:
```powershell
npm install                    # installs devDependencies locally
# OR
npm install -g tsx             # installs globally
```

### Browser shows `HTTP 500.19` on the app URL
URL Rewrite or ARR module missing. Re-run Phase 1b.

### Browser shows `502 Bad Gateway` on `/api/*`
Node/PM2 process isn't running. Check:
```powershell
pm2 list
pm2 logs cabq-plan-api
```

### Port 8080 times out from your workstation
Firewall rule missing on server. Re-run:
```powershell
New-NetFirewallRule -Name "App-Port-8080-In-TCP" -DisplayName "App Port 8080" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
```

### `npm install` fails on the server (network errors)
Server needs proxy or lacks internet. Set:
```powershell
npm config set proxy http://yourproxy:port
npm config set https-proxy http://yourproxy:port
```
Or install dependencies offline by copying `node_modules` from a matching OS/Node version workstation (last resort — native modules may break).

---

## Why `--env production` on a DEV server?

`env_production` is a **PM2 convention**, not a server-environment label. PM2 lets you define multiple env blocks (`env_production`, `env_development`, etc.) and `--env <name>` picks which block's variables to load — it effectively sets `NODE_ENV` for the Node.js runtime.

- **`NODE_ENV=production`** — frameworks (Fastify, React SSR, etc.) skip dev-only overhead (stack traces, dev logging) for better performance. Use on staging and prod servers.
- **`NODE_ENV=development`** — verbose errors, dev warnings. Use on DEV if you want easier debugging.

The `ecosystem.config.cjs` above defines **both** blocks, so you pick at start time:
```powershell
pm2 start ecosystem.config.cjs --env development   # on DTIAPPSINTDEV
pm2 start ecosystem.config.cjs --env production    # on DTIAPPSINTPRD
```
