# Publish the Dev Site at https://cpactions-dev.cabq.gov

**Audience:** You (the app owner), not a web server admin. Every step tells
you exactly where to click, what to paste, and how to verify.

**Goal:** Move from the current internal-only URL
`http://DTIAPPSINTDEV:8080` to a friendly, HTTPS-secured, CABQ-hostname URL:

> **https://cpactions-dev.cabq.gov**

Ops does the hard parts (DNS, TLS certificate, firewall). You handle IIS
bindings, the Azure Entra redirect, and a rebuild/redeploy. The running
application code does not change.

---

## Architecture after cutover

```
CABQ staff browser
        |
        | https:// (port 443)
        v
Internal DNS  ->  cpactions-dev.cabq.gov  ->  DTIAPPSINTDEV
        |
        v
IIS on DTIAPPSINTDEV  (port 443, TLS cert bound)
   |                                  |
   | static files from                | ARR reverse-proxy /api/*
   | D:\cabq-plan\dist                v
                              PM2 Fastify on localhost:8787
                                      |
                                      v
                              SQLite at D:\cabq-plan\data
```

The blue existing pieces (PM2, Fastify, SQLite, IIS at 8080) stay exactly
where they are. You are adding a new 443 binding on the **same IIS site**
and swapping the public URL used by Entra.

---

## Roles and responsibilities

| Step | Who does it | Typical SLA |
|---|---|---|
| Phase 0 - DNS record, TLS cert, firewall rule, SMTP relay info | **Ops** (via ticket in `deployment/OPS-REQUEST-DNS-CERT.md`) | 2-5 business days |
| Phase 1 - Install the cert in IIS | **You** (RDP to DTIAPPSINTDEV) | 10 minutes |
| Phase 2 - Add the HTTPS binding | **You** (IIS Manager) | 5 minutes |
| Phase 3 - Redirect 8080 -> 443 (optional) | **You** | 10 minutes |
| Phase 4 - Add the new redirect URI in Entra | **You** or your Entra admin | 5 minutes |
| Phase 5 - Update server `.env` with the new URL | **You** | 2 minutes |
| Phase 6 - Rebuild + redeploy the SPA | **You** from your workstation | 10 minutes |
| Phase 7 - Smoke test | **You** | 10 minutes |

> If your Entra app is managed by a different admin at CABQ, give them the
> single line from Phase 4 and they can do it in 30 seconds.

---

## Phase 0 - Prerequisites from Ops

**Before you start Phase 1, Ops must have completed all of these.** The
request template is in `deployment/OPS-REQUEST-DNS-CERT.md`.

Ops delivers:

1. **DNS record** - `cpactions-dev.cabq.gov` resolves to DTIAPPSINTDEV on
   the internal CABQ network.
2. **TLS certificate file** - either a `.pfx` with a password (most common
   from internal CAs), or a `.cer` + private key, for the hostname
   `cpactions-dev.cabq.gov`.
3. **Firewall** - inbound TCP 443 open to DTIAPPSINTDEV from the internal
   network and VPN subnets.

### How you verify Ops is done

Run these from **your workstation** (not the server). All three should
succeed before you continue.

```powershell
# 1. DNS resolves
Resolve-DnsName cpactions-dev.cabq.gov
# Expected: one or more IP addresses, no "DNS name does not exist" error.

# 2. Port 443 is reachable from your workstation
Test-NetConnection cpactions-dev.cabq.gov -Port 443
# Expected: TcpTestSucceeded : True

# 3. Ops handed you the cert file
Test-Path "C:\Users\<you>\Downloads\cpactions-dev.cabq.gov.pfx"
# Expected: True
```

If any of these fail, reply to the Ops ticket with the exact output. **Do
not continue to Phase 1 until all three pass**, or you will just waste
time and have to redo the binding.

---

## Phase 1 - Install the TLS certificate on DTIAPPSINTDEV

RDP to the server:

```
mstsc /v:DTIAPPSINTDEV
```

Copy the `.pfx` file from your workstation into
`D:\cabq-plan\certs\cpactions-dev.cabq.gov.pfx` on the server (create the
folder if it doesn't exist). The password Ops gave you is needed in step 5
below.

1. Press **Windows key**, type `certlm.msc`, press **Enter**. This opens
   **Certificate Manager - Local Computer**. (Must be the machine store,
   not your personal store.)
2. In the left pane, expand **Personal** -> right-click **Certificates**
   -> **All Tasks** -> **Import...**
3. **Next** -> **Browse** -> change the file filter to **Personal
   Information Exchange (*.pfx)** -> select the pfx file -> **Open** ->
   **Next**.
4. Paste the password Ops gave you. Check:
   - **Mark this key as exportable** - leave UNCHECKED (safer; Ops can
     re-issue if needed).
   - **Include all extended properties** - checked.
   Click **Next**.
5. Choose **Place all certificates in the following store:** -> **Personal**
   (should already be selected). **Next** -> **Finish**.
6. Refresh the **Personal \ Certificates** view. You should see a new row
   with:
   - **Issued To:** `cpactions-dev.cabq.gov`
   - **Expiration Date:** whatever Ops wrote in the ticket
   - **Intended Purposes:** `Server Authentication`

**Verify the private key is attached** (common gotcha): right-click the
new cert -> **Open** -> **General** tab should say *"You have a private
key that corresponds to this certificate."* If it doesn't, the import
didn't include the key - go back to step 3 and re-import the `.pfx`, not
just a `.cer`.

---

## Phase 2 - Add the HTTPS binding to the cabq-plan IIS site

Still on DTIAPPSINTDEV:

1. Press **Windows key**, type `inetmgr`, press **Enter**. This opens
   **IIS Manager**.
2. In the left tree: expand **DTIAPPSINTDEV** -> **Sites** -> click
   **cabq-plan** (the site you set up in
   [deployment/MANUAL-DEPLOY.md](MANUAL-DEPLOY.md)).
3. In the far-right **Actions** pane, click **Bindings...**
4. Click **Add...**
5. Fill in:
   - **Type:** `https`
   - **IP address:** `All Unassigned`
   - **Port:** `443`
   - **Host name:** `cpactions-dev.cabq.gov`
   - **Require Server Name Indication:** checked (lets multiple HTTPS
     sites share port 443 on the same server)
   - **SSL certificate:** pick `cpactions-dev.cabq.gov` from the dropdown
     (it's the one you imported in Phase 1)
6. Click **OK** -> **Close**.
7. **Do not remove** the existing `http 8080` binding yet. Leave it as a
   fallback for the cutover.

### Quick verify (on the server, PowerShell)

```powershell
Import-Module WebAdministration
Get-WebBinding -Name "cabq-plan" | Format-Table protocol, bindingInformation, sslFlags
```

You should see both bindings:

```
protocol bindingInformation              sslFlags
-------- --------------------             --------
http     *:8080:                                 0
https    *:443:cpactions-dev.cabq.gov            1
```

`sslFlags = 1` means SNI is on. Good.

### Quick verify (from your workstation)

Open a browser and hit **https://cpactions-dev.cabq.gov**. You should see
the app's landing page load over HTTPS with a green padlock (the cert is
trusted because it was issued by the CABQ internal CA, which your
workstation trusts via AD group policy).

If you get a cert warning, it means either:
- The cert was issued by an untrusted CA (go back to Ops), or
- The cert subject doesn't match the hostname (check **Issued To** in
  Phase 1 step 6).

---

## Phase 3 - Redirect old URLs to the new one (optional but recommended)

So that anyone who bookmarked `http://DTIAPPSINTDEV:8080` lands on the new
URL automatically.

Edit `D:\cabq-plan\dist\web.config` on the server. Inside
`<system.webServer>` -> `<rewrite>` -> `<rules>`, add this rule BEFORE the
existing `/api/*` reverse-proxy rule:

```xml
<rule name="Force HTTPS canonical host" stopProcessing="true">
  <match url="(.*)" />
  <conditions logicalGrouping="MatchAny">
    <add input="{HTTPS}" pattern="off" />
    <add input="{HTTP_HOST}" pattern="^cpactions-dev\.cabq\.gov$" negate="true" />
  </conditions>
  <action type="Redirect" url="https://cpactions-dev.cabq.gov/{R:1}" redirectType="Permanent" />
</rule>
```

> **Do not edit the reverse-proxy rule** beneath this one. ARR needs it to
> forward `/api/*` to `http://localhost:8787/api/*`.

Save the file. IIS picks up `web.config` changes automatically (no reset
needed). Test from your workstation:

```powershell
# Should 301 -> https://cpactions-dev.cabq.gov/
curl.exe -I http://DTIAPPSINTDEV:8080/
```

---

## Phase 4 - Update the Entra app registration

**Who:** You or whoever owns the `cabq-plan` app registration in Azure
Entra. If the existing redirect URI list in Entra doesn't already include
`https://cpactions-dev.cabq.gov/auth/callback`, sign-in will fail with
**AADSTS50011: Reply URL mismatch** after Phase 5.

1. Go to **https://entra.microsoft.com** -> **Applications** -> **App
   registrations**.
2. Pick the CABQ Comprehensive Plan app (same one used in the
   original AADSTS700038 walkthrough).
3. Left menu -> **Authentication**.
4. Under **Platform configurations** -> **Single-page application** ->
   **Add URI**:
   ```
   https://cpactions-dev.cabq.gov/auth/callback
   ```
5. Under **Front-channel logout URL** (same section), set or leave:
   ```
   https://cpactions-dev.cabq.gov
   ```
6. Click **Save** at the top.

> Leave the existing `http://localhost:5173/auth/callback` and
> `http://DTIAPPSINTDEV:8080/auth/callback` entries in place so dev loops
> and cutover fallback still work.

---

## Phase 5 - Update the server `.env`

Edit `D:\cabq-plan\.env` on DTIAPPSINTDEV. Either through RDP with Notepad,
or copy-edit-paste the file via the mapped drive.

Set or add these lines (the keys match [.env.example](../.env.example)):

```ini
# Tell the SPA which redirect URI to use at runtime.
VITE_AZURE_REDIRECT_URI=https://cpactions-dev.cabq.gov/auth/callback

# Keep existing values - just confirm they're correct:
VITE_AZURE_CLIENT_ID=<your Entra app's Application (client) ID>
VITE_AZURE_TENANT_ID=<your Entra tenant GUID>
VITE_ALLOWED_EMAIL_DOMAINS=cabq.gov
AZURE_AUDIENCE=<your Application ID URI or client id>
```

**Do not change** `LOCAL_JWT_SECRET`, `BOOTSTRAP_ADMIN_*`, or the SQLite
path - those must stay stable across redeploys or local admin accounts
get invalidated.

---

## Phase 6 - Rebuild and redeploy the SPA

The redirect URI `VITE_AZURE_REDIRECT_URI` is a **build-time** variable in
Vite - it gets baked into the static JS bundle. Just editing `.env` on
the server is not enough; you must rebuild and redeploy.

### 6a. On your workstation

```powershell
cd C:\Users\e25347\CABQ-Comprehensive-Plan-Action-App
git checkout master
git pull

# Make sure your local .env (or .env.production) has the same
# VITE_AZURE_REDIRECT_URI value so the build picks it up:
notepad .env

# Build + push:
npm run deploy:sandbox
# (This runs scripts\push-to-sandbox.ps1 - see scripts\push-to-sandbox.ps1)
```

### 6b. On DTIAPPSINTDEV

```powershell
cd D:\cabq-plan
.\scripts\deploy.ps1
```

Expected output (see `scripts\deploy.ps1`):
- `OK  npm install --omit=dev completed`
- `OK  tsx CLI present`
- `OK  PM2 reload issued`
- `OK  GET http://127.0.0.1:8787/api/health -> 200`
- `OK  GET /api/auth/config -> 200 (new build is live)`
- `Deploy complete.` in green

---

## Phase 7 - Smoke test

All of these should pass on a machine on the CABQ network or VPN.

### 7a. Basic reachability

| Test | Expected |
|---|---|
| `https://cpactions-dev.cabq.gov` | Landing page renders, green padlock |
| `https://cpactions-dev.cabq.gov/api/health` | JSON `{"status":"ok",...}` |
| `https://cpactions-dev.cabq.gov/api/auth/config` | JSON listing the auth config (tenant, client id, etc.) |
| `http://DTIAPPSINTDEV:8080` (if Phase 3 added) | 301 redirect to `https://cpactions-dev.cabq.gov` |

### 7b. Microsoft sign-in

1. Open **https://cpactions-dev.cabq.gov** in a private window.
2. Click **Sign in with Microsoft**.
3. Complete MFA.
4. Expect to land back at `https://cpactions-dev.cabq.gov/app` with
   **Logged in as: <your name>** in the header.

If sign-in fails with **AADSTS50011 Reply URL mismatch** -> redo Phase 4
(the redirect URI in Entra doesn't exactly match the URL the SPA is
sending; they are case-sensitive and path-sensitive).

If sign-in fails with **AADSTS700038** -> the client ID in `.env` is
still zeros. Fix `VITE_AZURE_CLIENT_ID` in Phase 5 and rebuild.

### 7c. Admin console

1. Go to **https://cpactions-dev.cabq.gov/admin**.
2. Sign in either with the Microsoft tab (your Entra account, must hold
   `comp-plan-admin` role) **or** the Local tab (the bootstrap admin from
   `.env`).
3. Navigate to **Reports**. All 5 cards should be live:
   - Submissions Overview
   - User Activity
   - Authentication & Security (try the CSV export)
   - Coverage / Gap Analysis
   - Submission Lifecycle / Turnaround

### 7d. Audit trail check

After you sign in above, in the admin console go to **Audit log**. You
should see a fresh `LOGIN_SUCCESS` event for your account with the new
hostname in the client IP or request URL context.

---

## Communicating the URL to reviewers

Once Phase 7 passes, send this one-liner to your reviewers:

> The CABQ Comprehensive Plan Action App dev build is now available at
> **https://cpactions-dev.cabq.gov**. Sign in with your @cabq.gov
> Microsoft account while connected to the CABQ network or VPN. This is
> a pre-production build - feedback welcome.

---

## Rollback

If something goes sideways after Phase 6 and you need the old URL back
fast:

1. Leave DNS and Entra as-is (they do not break the old URL).
2. On the server, edit `D:\cabq-plan\.env`, revert
   `VITE_AZURE_REDIRECT_URI` to whatever it was before (or delete the
   line so the SPA falls back to `{origin}/auth/callback`).
3. Rebuild and redeploy (Phase 6).
4. Keep the 8080 HTTP binding in place indefinitely - nothing breaks
   by having both HTTPS 443 and HTTP 8080 bound to the same site.

For a deeper rollback to an earlier build, use the tags documented in
[CHANGELOG.md](../CHANGELOG.md):

```powershell
git checkout v4.2.0   # or whatever known-good tag
npm run deploy:sandbox
# then on server:
.\scripts\deploy.ps1
```

---

## Troubleshooting

### Browser shows `ERR_CERT_AUTHORITY_INVALID` or `NET::ERR_CERT_COMMON_NAME_INVALID`

- The workstation doesn't trust the issuing CA. If CABQ's internal CA is
  deployed via AD group policy, the workstation may need a `gpupdate
  /force` and a browser restart.
- The cert's **Subject Alternative Names** don't include
  `cpactions-dev.cabq.gov`. Ops needs to re-issue with SANs for both the
  common name and the hostname.

### `502 Bad Gateway` on `/api/...` after cutover

- PM2 isn't running or crashed. On the server:
  ```powershell
  pm2 list
  pm2 logs cabq-plan-api --lines 50
  ```
- URL Rewrite / ARR got uninstalled or the reverse-proxy rule in
  `web.config` got edited by mistake. See Phase 3 warning.

### `AADSTS50011 Reply URL mismatch`

- The Redirect URI in Entra (Phase 4) must be **character-exact** -
  `https://cpactions-dev.cabq.gov/auth/callback` with no trailing
  slash, lowercase.

### `AADSTS500113 Missing reply URL` or `AADSTS90102 scope not allowed`

- The Entra app's **API permissions** page needs the default
  `access_as_user` scope. Go to **App registrations** -> your app ->
  **Expose an API** -> confirm the scope exists and is consented.

### Site loads but `/api/health` times out

- `web.config` in `D:\cabq-plan\dist` lost the ARR reverse-proxy rule.
  Compare with the committed template in [public/web.config](../public/web.config)
  and re-deploy.

### `404 Not Found` on any SPA route (e.g., `/admin`)

- The SPA-fallback rewrite rule in `web.config` is missing. It must
  send unknown paths to `/index.html`. See the committed template in
  [public/web.config](../public/web.config).

---

## When production cuts over to `cpactions.cabq.gov`

This exact same document applies - just replace:
- Hostname: `cpactions-dev.cabq.gov` -> `cpactions.cabq.gov`
- Server: `DTIAPPSINTDEV` -> the production host (typically `DTIAPPSINTPRD`)
- Entra: add the production redirect URI to the same app registration
- TLS cert: request a fresh cert for the production hostname

Everything else - IIS binding steps, `.env` keys, rebuild flow - is
identical. This doc is the template.
