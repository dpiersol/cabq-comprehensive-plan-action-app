# Changelog

## [4.4.2] — 2026-04-18

### Fix — Dev Admin Login lands on the admin SPA, not the MS sign-in page

`DevLoginPage` redirected admins to `/admin/` but the Vite build ships
the admin console as a second entry bundle at **`/admin.html`** (see
`vite.config.ts` `rollupOptions.input.admin`). Without the `.html`
suffix the request fell through to the main SPA's wildcard route,
which redirected to `/`, which surfaced the Microsoft sign-in button.
The rest of the codebase (`SiteHeaderUserBar`, `AdminSubmissionDetail`)
already uses `/admin.html`; this brings `DevLoginPage` into line.

Changed: `src/pages/DevLoginPage.tsx` — admin redirect target is now
`/admin.html` instead of `/admin/`.

## [4.4.1] — 2026-04-18

### Fix — local session survives the hard nav into the main SPA

v4.4.0 shipped `/devlogin` but the main user SPA couldn't see the
resulting local-session token, so clicking "Dev User Login" issued
the JWT, hard-navigated to `/app`, and then bounced straight back to
the landing page (where MSAL's "Sign in with Microsoft" button was
waiting). Three small fixes in `src/`:

1. **`src/App.tsx`** — added a side-effect import of
   `./auth/localSession` so its module-top `loadFromStorage()` +
   `restoreIfValid()` restore the token into the shared auth store
   as soon as the main bundle boots. Previously `localSession.ts`
   was only imported from admin-side code, so the main SPA never
   ran the restore path.
2. **`src/components/EntraAuthSync.tsx`** — early-returns when a
   local session is present, so MSAL's empty-accounts case doesn't
   clobber the dev identity with `setAuthUser(null)`.
3. **`src/components/ProtectedRoute.tsx`** — accepts any non-expired
   local session as valid and bypasses the `@cabq.gov` domain check
   for them. The dev identities use `@dev.local` emails on purpose
   (to make them obvious in audit logs), so they would otherwise
   fail the domain whitelist even if authenticated.

No server or schema changes; SignOutButton already handled local
sessions (sprint 3.8.0). Full test suite still 101/101.

## [4.4.0] — 2026-04-18

### Sandbox-only dev login (`/devlogin`)

Adds a dedicated `/devlogin` page that lets reviewers click into the user
and admin sides of the app without a real password. This is **strictly
sandbox-only** and is blocked from production by four independent gates.

**New: `POST /api/auth/dev-login`** (body `{ role: "user" | "admin" }`)

Issues a short-lived local-session JWT for a synthetic identity:

- `user` → `local:devlogin-user`, no app roles, display name "Dev User".
- `admin` → `local:devlogin-admin`, `roles: ["comp-plan-admin"]`,
  display name "Dev Admin".

The synthetic identities are **not inserted into the `local_users`
table**, so they cannot interfere with the "last admin" safeguard or
normal username / password sign-in. Every successful dev-login writes
an `auth_audit` row with `action = "dev_login_used"` so any use is
immediately visible in the admin Audit log.

**New: `GET /api/auth/dev-login/status`** — always on, returns
`{ enabled: boolean }` so the SPA can render the page conditionally.

**New: `src/pages/DevLoginPage.tsx`** at route `/devlogin` — one page
with two buttons (Dev User Login / Dev Admin Login). When the build
flag or server flag is off, renders a safety stub explaining why the
page is inactive. On success, does a hard navigation to `/app` (user)
or `/admin/` (admin) so both SPAs pick up the new session from storage.

**Production safety (four independent gates)**

1. **Build gate** — `VITE_DEV_LOGIN_ENABLED=true` is only set by
   `.env.sandbox`, consumed by the new `npm run build:sandbox`. The
   regular `npm run build` (used for production bundles) leaves the
   flag undefined, so `isDevLoginBuild()` returns `false` and the
   login buttons never render.
2. **Server gate** — `registerDevLoginRoutes()` is a no-op unless
   `ENABLE_DEV_LOGIN=true`. Without the flag the POST route simply
   does not exist and requests return 404.
3. **Startup refuse-to-run** — `assertDevLoginSafeForStartup()` runs
   before Fastify is created. If it sees `ENABLE_DEV_LOGIN=true` AND
   `NODE_ENV=production` without an explicit
   `CONFIRM_DEV_LOGIN_IN_PRODUCTION=yes-i-really-want-this` override,
   it throws and the API refuses to start.
4. **Audit trail** — even under an authorised override, every
   dev-login writes an audit row so misuse is observable.

**Deploy**

`scripts\push-to-sandbox.ps1` gains a `-WithDevLogin` switch that runs
`npm run build:sandbox` instead of the prod build. The server still
needs `ENABLE_DEV_LOGIN=true` in its `.env`; the script prints a
reminder.

**Tests**

12 new vitest cases in `server/devLogin.test.ts` cover:

- startup gate (unset / non-prod / prod refuses / override permits),
- status endpoint (off / on),
- POST route absent when disabled (404),
- POST issues valid user / admin tokens when enabled,
- unknown role rejected with 400,
- missing `LOCAL_JWT_SECRET` rejected with 503,
- dev-admin token successfully passes `/api/admin/submissions`.

Full backend suite: 101 / 101 passing.

**Files**

- added: `server/devLoginRoutes.ts`, `server/devLogin.test.ts`,
  `src/auth/devLogin.ts`, `src/pages/DevLoginPage.tsx`, `.env.sandbox`.
- changed: `server/app.ts`, `src/App.tsx`, `package.json`,
  `.env.example`, `scripts/push-to-sandbox.ps1`.

## [4.3.0] — 2026-04-20

### Documentation — publish-to-dev-DNS, Ops request, email/notifications roadmap

Adds three operational guides that take the dev build from its current
internal-only URL (`http://DTIAPPSINTDEV:8080`) to a proper internal
HTTPS hostname (`https://cpactions-dev.cabq.gov`), and locks in the
foundation for future email notifications without any code change today.

**New: `deployment/PUBLISH-TO-DEV-DNS.md`**

Step-by-step cutover for a non-admin app owner. Covers:

- Phase 0 prerequisites and how to verify Ops finished (DNS resolves,
  port 443 reachable, `.pfx` received).
- Phase 1 TLS certificate install via `certlm.msc` with private-key
  verification.
- Phase 2 adding the HTTPS binding to the `cabq-plan` IIS site via
  IIS Manager with Server Name Indication on.
- Phase 3 optional URL Rewrite rule forcing HTTPS + canonical host.
- Phase 4 updating the Azure Entra app registration with the new
  SPA redirect URI and front-channel logout URL.
- Phase 5 editing `D:\cabq-plan\.env` for `VITE_AZURE_REDIRECT_URI`
  and the other auth keys already documented in `.env.example`.
- Phase 6 rebuild + redeploy using the existing
  `scripts/push-to-sandbox.ps1` + `scripts/deploy.ps1` flow.
- Phase 7 smoke tests (SPA load, `/api/health`, `/api/auth/config`,
  Microsoft sign-in, admin reports, audit log).
- Rollback path and troubleshooting for the common failure modes
  (AADSTS50011 reply URL mismatch, AADSTS700038 zeros client id,
  502 on `/api/*`, cert-authority-invalid, SPA 404 on `/admin`).
- Template reuse for future production cutover to `cpactions.cabq.gov`.

**New: `deployment/OPS-REQUEST-DNS-CERT.md`**

Ready-to-paste ticket for CABQ IT Operations. Explicitly asks for four
things in one place, with every field Ops usually asks back for
pre-populated:

- Internal DNS `cpactions-dev.cabq.gov` -> `DTIAPPSINTDEV`, internal
  zone only.
- TLS cert for that hostname (SANs, delivery format, renewal contact,
  internal-CA trust, production-cert policy).
- Firewall inbound TCP 443 from CABQ LAN + VPN; keep existing 8080
  open during cutover.
- SMTP relay info + dedicated sender `comp-plan-noreply@cabq.gov` +
  optional `comp-plan-support@cabq.gov` mailbox.

**New: `docs/EMAIL-NOTIFICATIONS-ROADMAP.md`**

Foundation document for the v5.x email/notifications feature. No code
today - reserves env var names and locks the architecture in so future
PRs don't re-litigate the design:

- Reserved env keys (`NOTIFICATIONS_ENABLED`, `SMTP_*`,
  `NOTIFICATIONS_ALLOWED_DOMAINS`, etc.) with safe defaults.
- Outbox-pattern architecture (queue -> drain worker -> channel
  adapter) so transient relay outages never lose a message.
- Planned `server/notifications/` module layout and channel interface
  that accommodates SMTP today, MS Graph `sendMail` and Teams later.
- Migration 6 schema for `notifications` + `notification_preferences`
  with status lifecycle (`queued` -> `sending` -> `sent` /
  `failed` / `suppressed`).
- Hook points in the existing code
  (`server/submissionsRepo.ts`, `server/localAuthRoutes.ts`,
  `server/auditRepo.ts`) showing exactly where we'll wire in sends.
- Template format (Handlebars: subject + plaintext + HTML bodies).
- Planned `Admin console -> Notifications` page (templates, delivery
  log, test-send) under the Security nav group alongside Reports.
- Security rules baked in from day one: domain allow-list, dev-redirect
  safety net, per-user preferences, rate limits, audit log coverage.
- Phased rollout plan v5.0.0 -> v5.3.0 mirroring the Reports initiative.

**Versioning rationale**

Minor bump (4.2.x -> 4.3.0) because we're adding reserved public-facing
env var names and new docs under `deployment/` and `docs/`, but no
runtime behavior change.

**No application / dependency changes.** `npm install`, build, lint, and
tests are unaffected - this release is documentation only.

## [4.2.1] — 2026-04-20

### Chore — dependency hygiene

Sync the dev repo's `package-lock.json` with the sandbox server's lockfile
after an in-place `npm audit fix` was run there on 2026-04-20. The server
was patched during the v4.2.0 deploy; this release makes sure the dev box,
any future sandbox push, and production all install the same patched
versions instead of regressing.

**Notable bumps** (all within existing semver ranges — no code changes):

- `axios` 1.14.0 → 1.15.1
- `fastify` 5.8.4 → 5.8.5
- `follow-redirects` 1.15.11 → 1.16.0
- `postcss` 8.5.8 → 8.5.10
- `vite` 8.0.3 → 8.0.9
- `rolldown` 1.0.0-rc.12 → 1.0.0-rc.16 (all platform bindings)
- `@emnapi/core`, `@emnapi/runtime`, `@emnapi/wasi-threads` patch bumps
- `@napi-rs/wasm-runtime` 1.1.2 → 1.1.4
- `@oxc-project/types` 0.122.0 → 0.126.0
- `tinyglobby` 0.2.15 → 0.2.16
- `nanoid` hoisted from `postcss/node_modules/` to top-level (now 3.3.11)

**Verification**

- `npm audit` → 0 vulnerabilities
- `npm run lint` → clean
- `npm test` → 89/89 passing (18 files)
- `npm run build` → SPA built with vite 8.0.9, bundle sizes unchanged
  (main 460.91 kB gzip 143.71 kB, EntraAuthSync 430.20 kB gzip 122.19 kB,
  admin 112.55 kB gzip 27.94 kB)

**Why bump the patch version?** So anyone later looking at
`Z:\cabq-plan\package.json` on the sandbox can see at a glance
"this is the audit-patched build", and the git tag matches what's
actually installed.

## [4.2.0] — 2026-04-18

### Reports — phase 3 of 3 (final)

Closes the Reports initiative. Adds the Submission Lifecycle / Turnaround
report plus the infrastructure it needs to produce meaningful numbers.

**DB migration 5 — `submission_status_history`**

New table tracking every status transition, with both a `from_status` and
`to_status`, an `actor`, and a timestamp. Indexed on
`(submission_id, at)` and `at` for fast per-submission and global queries.
Foreign-key-cascades on `submissions.id`.

**Backfill**: migration 5 synthesizes history for every pre-existing
submission so the report is immediately useful after deploy. Each
submission gets a "created as draft" row at its `created_at`; submitted
submissions additionally get a `draft → submitted` row at their
`submitted_at` (falling back to `updated_at` when null).

**Retrofit**: `insertSubmission`, `patchSubmission` (user), and `patchAny`
(admin) in `server/submissionsRepo.ts` now append a transition row each
time the status effectively changes. Zero-change patches don't emit spurious
rows.

**Report #4 — Submission Lifecycle / Turnaround (`#reports/lifecycle`)**

- Headline KPIs:
  - In draft now, submitted total.
  - Median / p90 draft → submitted turnaround.
  - Median / max age of open (never-submitted) drafts, with warning tone
    when median > 7 days or oldest > 30 days.
- Two stats tables: draft→submitted turnaround and open-draft age — each
  showing `n, min, median, p90, max, avg` in human units (`Xm/Xh/Xd/Xmo`
  auto-picked per value size).
- **Oldest drafts** table (top 15) with a direct link into each
  submission's admin detail page.
- **By month** bar chart + table showing monthly submission volume and
  median turnaround — a simple trendline.

**Backend**

- `getSubmissionLifecycle()` in `server/reports/reportsRepo.ts`.
- `GET /api/admin/reports/lifecycle` (admin-gated JSON).
- 2 new vitest cases (migration 5 hook verification; deterministic
  turnaround stats with hand-seeded history). Full suite: **89/89**
  passing across 18 files.

**Frontend**

- `src/admin/reports/LifecyclePage.tsx`. Landing card now shows "Ready
  (v4.2.0)" — all five planned reports are live.

Breaking: none on the API surface. Schema change: migration 5 runs
automatically on first boot of v4.2 against existing DBs.

## [4.1.0] — 2026-04-18

### Reports — phase 2 of 3

Adds two more reports under Admin → Security → Reports. Phase 3 (Submission
Lifecycle / Turnaround, v4.2.0) remains the final piece and needs a new DB
migration to capture status transitions.

**Report #3 — Authentication & Security (`#reports/auth-security`)**

- KPIs: successful logins, failed logins, lockouts, password changes, user
  changes, role changes, SSO-config edits.
- Daily stacked bar chart (7 / 30 / 60 / 90 / 180 days) grouping raw
  `auth_audit.action` values into high-level categories: `login_success`,
  `login_failed`, `password_change`, `user_change`, `role_change`,
  `sso_config`.
- Failed-login watchlist: top 15 identifiers by failure count over the
  window, with a **distinct-IP** column to help spot brute-force or
  credential-stuffing patterns.
- Latest-activity tail (last 25 events) with category swatches.
- **CSV export**: `GET /api/admin/reports/auth-audit.csv?days=1..365`
  streams an RFC-4180-style CSV with `id,at,action,category,actor,target,
  detail`. Client uses an authenticated `fetch` + `Blob` flow so identity
  headers are attached (a plain `<a download>` can't do that).

**Report #5 — Coverage / Gap Analysis (`#reports/coverage`)**

- Loads `public/data/comprehensive-plan-hierarchy.json` (or the deployed
  `dist/data/` equivalent) server-side and cross-references it against
  every submission's `planItems[]`.
- KPIs: chapters, goals, goals covered/uncovered, policies (in plan /
  covered), submissions mapped.
- **Coverage by chapter** table: goals total vs. covered, percent bar,
  submissions touching the chapter. Filters: All · With uncovered goals ·
  Zero submissions.
- **Uncovered goals** table — the gaps list. Every chapter/goal pair the
  plan contains that no submission has cited.
- **Most-cited goals** table — saturation view, top 10.
- Client-side CSV export of the gap list.
- Graceful fallback: when the hierarchy JSON isn't found on the server the
  endpoint returns `planLoaded: false` and the UI shows a clear error.

**Backend additions**

- New helpers in `server/reports/reportsRepo.ts`:
  `getAuthSecurity()`, `getAuthAuditCsv()`, `getCoverageGaps()`, plus
  `setPlanDataForTests()` / `resetPlanCacheForTests()` seams.
- New routes in `server/reports/reportsRoutes.ts`:
  `GET /api/admin/reports/auth-security?days=7..180`,
  `GET /api/admin/reports/auth-audit.csv?days=1..365`,
  `GET /api/admin/reports/coverage`.
- 5 new vitest cases (auth category roll-up, `days` clamping, CSV
  quoting/headers, coverage without a plan, coverage math with a synthetic
  plan). Total backend suite: **35/35** passing.

**Frontend additions**

- `src/admin/reports/AuthSecurityPage.tsx`,
  `src/admin/reports/CoveragePage.tsx`. Landing cards flip from "Coming in
  v4.1.0" to ready.
- CSS: stacked bar chart variant, legend swatches, coverage bar, warning
  KPI tone.

Breaking: none (additive only).

## [4.0.0] — 2026-04-18

### Reports — phase 1 of 3 (Admin → Security → Reports)

First slice of the new Reports area under the Admin Console's Security nav
group. Phase 1 ships the foundation and the two fastest-to-deliver reports.
Phase 2 (v4.1.0) will add Authentication & Security plus Coverage / Gap
Analysis; phase 3 (v4.2.0) will add Submission Lifecycle (requires DB
migration 5 for status history).

**New admin area**

- Security group in the top admin nav (visual "Security:" separator) now
  contains Users, Roles, Sign-in settings, Audit log, and **Reports**.
- `#reports` landing page with cards for all five planned reports, clearly
  badged as ready-now (4.0.0) or coming in 4.1.0 / 4.2.0.

**Report #1 — Submissions Overview (`#reports/submissions`)**

- KPIs: total, submitted, draft, created last 7/30d, submitted last 7/30d.
- 4/13/26/52-week submitted-per-week bar chart (server buckets by Monday).
- Top 10 most-cited comp-plan goals with chapter + goal names resolved from
  the admin's loaded plan hierarchy JSON.
- "Unmapped" count flags submissions with no parseable plan items.

**Report #2 — User Activity (`#reports/users`)**

- Local users table: username, email, roles, Active/Locked/Dormant status,
  last-login + days-since, submitted/draft counts. Filters for All, Active,
  Admins, Locked, Dormant > 90d.
- Non-local submitters table: emails with submissions but no local account
  (SSO / header-based identities), sorted by total submissions.
- Totals: local users, active, admins, dormant > 90d.

**Backend**

- New `server/reports/reportsRepo.ts` (pure SQL aggregation helpers) and
  `server/reports/reportsRoutes.ts` (admin-gated JSON endpoints).
- `GET /api/admin/reports/submissions-overview?weeks=4..52` (clamped).
- `GET /api/admin/reports/user-activity`.
- 5 vitest cases in `server/reports/reports.test.ts` covering auth gates,
  KPI math, goal-counting, non-local submitter detection, and weeks
  clamping. Full backend suite: 30/30 passing.

**Frontend**

- New `src/admin/reports/` folder: `reportsApi.ts`, `ReportsLanding.tsx`,
  `SubmissionsOverviewPage.tsx`, `UserActivityPage.tsx`.
- New admin CSS: nav Security group label, report cards, KPI tiles, weekly
  bar chart, status badges.

Breaking: none (additive only — new routes + UI). Version bumped to 4.0.0
because this begins a new major feature area (Reports) and the UI surface
gains a persistent nav concept ("Security group").

## [3.8.3] — 2026-04-18

### Deployment scripts

- **`scripts/deploy.ps1`** — one-command post-deploy runner for the sandbox /
  prod server. Runs `npm install --omit=dev` (which also rebuilds native
  modules like `better-sqlite3` against the server's Node), verifies `tsx`
  is present, issues `pm2 reload ecosystem.config.cjs --update-env
  --env production`, then HTTP-probes `/api/health` and `/api/auth/config`
  to confirm the new build is actually live. Supports `-SkipInstall`,
  `-RebuildNativeOnly`, and `-NoHealthCheck`.
- **`scripts/push-to-sandbox.ps1`** — dev-box companion. Builds the SPA,
  robocopies `dist\`, `server\`, `package.json`, `package-lock.json`,
  `ecosystem.config.cjs`, and `scripts/deploy.ps1` onto the mapped drive
  (default `Z:\cabq-plan`). Deliberately does **not** run `npm install`
  on the target — native modules must be compiled on the server itself.
- **`npm run deploy:sandbox`** — convenience shortcut for the push script.

Together the two scripts remove the manual robocopy / `npm rebuild` dance
and prevent the `NODE_MODULE_VERSION` mismatch that happened when the dev
box's Node version differed from the server's.

## [3.8.2] — 2026-04-18

### Runtime / PM2 — server actually starts on the sandbox

- **`tsx` is now a production dependency.** The Fastify API is launched
  directly from TypeScript via `tsx` (there is no compiled `dist/index.js`
  — `tsconfig.server.json` is `noEmit: true`), so `tsx` must survive
  `npm install --omit=dev`. Moving it from `devDependencies` to
  `dependencies` prevents `ERR_MODULE_NOT_FOUND: Cannot find package 'tsx'`
  on reload after a production install.
- **`ecosystem.config.cjs` now launches the correct entry.** The previous
  config pointed at a non-existent `dist/index.js`; PM2 now runs
  `./node_modules/tsx/dist/cli.mjs` with `server/index.ts` as its arg.
  This is the same thing `npm run dev:server` does, just under PM2.

## [3.8.1] — 2026-04-18

### Server env loading — `dotenv`

- **`.env` auto-loads on server start** — `server/index.ts` now calls `dotenv/config` before any other import, so runtime variables (`LOCAL_JWT_SECRET`, `BOOTSTRAP_ADMIN_*`, `AZURE_*`, `ADMIN_*`, etc.) can live in a single **`.env`** file next to the running process. Real environment variables (e.g. those set by PM2 in `ecosystem.config.cjs`) still win — `dotenv` only fills in what's not already defined.
- **`.gitignore`** — Now ignores `.env` and `.env.*` by default, with explicit allow-list entries for the tracked templates (`.env.example`, `.env.production`, `.env.e2e`) so secrets cannot be committed by accident.

## [3.8.0] — 2026-04-18

### Sprint 8 — Admin UI: tabbed sign-in + user / role / SSO management

- **Tabbed admin login** — `admin.html` now shows **Local account** and **Microsoft (SSO)** tabs, driven by the public **`/api/auth/config`** endpoint so the visible options match server capability (and the local tab hides if `LOCAL_JWT_SECRET` isn't configured). Local sign-in posts to `/api/auth/local/login` and stores the bearer in `localStorage` for refreshes.
- **Forced password change** — Accounts flagged `mustChangePassword` (bootstrap admin, admin reset) see a dedicated *Choose a new password* page before the rest of the admin UI unlocks.
- **Admin navigation** — New header tab bar: **Submissions · Users · Roles · Sign-in settings · Audit log** (hash-routed). Sign-out clears the local session or Entra session as appropriate.
- **Users page** (`#users`) — Create, edit, deactivate, and delete local users; assign roles; admin-initiated password reset (forces change on next login). Last-admin safeguard surfaces as an inline error.
- **Roles page** (`#roles`) — Add / delete custom roles (built-ins protected), with live member counts and active-admin badge.
- **Sign-in settings page** (`#settings`) — Toggle SSO / local on or off; edit tenant id / client id / audience / issuer / allowed domains / admin role names / admin emails; paste a real Entra token into *Test SSO* for a server-side dry-run verification.
- **Audit log page** (`#audit`) — Tail the last 200 auth events from `auth_audit`, with optional action-name filter (`local_login_success`, `admin_user_update`, `admin_auth_config_update`, etc.). Refresh on demand.
- **Unified bearer plumbing** — `adminApi.ts` and the new `authAdminApi.ts` prefer the local-session token over MSAL's silent token when present, so admins don't need an Entra tenant to use the console.

## [3.7.0] — 2026-04-18

### Sprint 7 — SSO configuration managed in the database

- **Dynamic auth config** — New **`auth_config`** key/value table holds SSO & local-auth settings. The new **`getEffectiveAuthConfig(db)`** helper merges DB values over env defaults (`AZURE_TENANT_ID`, `AZURE_AUDIENCE`, `AZURE_CLIENT_ID`, `AZURE_ISSUER`, `ADMIN_ROLE_NAMES`, `ADMIN_EMAILS`, `ALLOWED_EMAIL_DOMAINS`) so the sandbox can tweak SSO without a restart and existing deployments keep working unchanged.
- **Public config endpoint** — **`GET /api/auth/config`** (unauthenticated) returns `{ sso: { enabled, tenantId, clientId, authority, allowedEmailDomains }, local: { enabled } }`. The upcoming admin login UI uses this to decide which tabs to show.
- **Admin config endpoints** —
  - **`GET /api/admin/auth/config`** — view the full effective SSO + local config (admin-only).
  - **`PATCH /api/admin/auth/config`** — update any subset of `{ ssoEnabled, localEnabled, tenantId, clientId, audience, issuer, allowedEmailDomains[], adminRoleNames[], adminEmails[] }`. Passing `null` / `""` for a string clears the DB override so env takes over again.
  - **`POST /api/admin/auth/test-sso`** — admin-only dry-run: verifies a sample access token against the current (or supplied) tenant/audience/issuer and reports the resolved claims. Writes a success/failure audit entry.
- **DB-aware token verification** — **`resolveOwner()`** now accepts a DB handle and validates Entra tokens with `verifyAzureBearerWithConfig(db, token)` — meaning tenant/audience/issuer changes made in the admin UI take effect on the next request, no restart required.
- **DB-aware admin check** — **`isAdminFor(db, owner)`** replaces the env-only `isAdmin(owner)` on every protected route, so DB-managed admin role names and allowlisted emails are honoured immediately.
- **Audit coverage** — Every config change (`admin_auth_config_update`) and test-sso attempt (`admin_auth_config_test_sso_success` / `…_failed`) is recorded in `auth_audit`.

## [3.6.0] — 2026-04-18

### Sprint 6 — Local admin accounts (back-end)

- **New auth source — local accounts** — Admins, operators, and vendors can now sign in with credentials managed inside the app (no Entra required). Passwords are hashed with **bcrypt** (cost 12) and stored in a new **`local_users`** table; tokens are short-lived HS256 JWTs signed with **`LOCAL_JWT_SECRET`** (default TTL **8 h**, tunable via **`LOCAL_JWT_TTL_SECONDS`**).
- **Unified request identity** — `resolveOwner()` now tries a local-session token first, then falls back to the existing Azure / header paths. Downstream code (submissions, admin endpoints, `isAdmin()`) treats both sources identically.
- **Account lockout & auditing** — Five bad password attempts (tunable via **`LOCAL_LOGIN_MAX_FAILS`** / **`LOCAL_LOGIN_LOCK_MINUTES`**) lock the account for **15 min**. Every login, admin-user change, role change, and password reset writes an **`auth_audit`** row.
- **Admin CRUD APIs** —
  - **`GET /api/auth/local/login`** → issues local-session JWT.
  - **`POST /api/auth/local/change-password`** → caller rotates own password.
  - **`GET/POST/PATCH/DELETE /api/admin/users[/:id]`** → list / create / edit / deactivate local users.
  - **`POST /api/admin/users/:id/reset-password`** → admin-initiated reset that forces change-on-next-login (the approved safeguard so a departed admin's password can always be rotated).
  - **`GET/POST/DELETE /api/admin/roles`** and **`POST/DELETE /api/admin/users/:id/roles`** → manage roles and assignments.
  - **`GET /api/admin/auth/audit`** → recent auth events, paginated.
- **Last-admin safeguard** — The last active user holding **`comp-plan-admin`** cannot be deleted, deactivated, or demoted; another admin must be promoted first.
- **Bootstrap admin** — On first start with an empty `local_users` table, a single admin is created from **`BOOTSTRAP_ADMIN_USERNAME`** / **`BOOTSTRAP_ADMIN_EMAIL`** / **`BOOTSTRAP_ADMIN_PASSWORD`** (/ **`…_DISPLAY`**) — flagged **must change password on first login**. In sandbox, env-based bootstrap; in production, an admin-created account is preferred.
- **Password policy** — Minimum 12 chars, at least 3 of {lower, upper, digit, symbol}, must not contain the username / email / display name.
- **Rate limit** — `/api/auth/local/login` is rate-limited (10 req / min / IP) via **`@fastify/rate-limit`**.
- **Schema — migration 4** — adds `local_users`, `roles`, `user_roles`, `auth_config`, `auth_audit` with indexes; seeds built-in `comp-plan-admin` / `comp-plan-user` roles.

## [3.5.0] — 2026-04-18

### UX polish — user & admin pages

- **Header identity** — Signed-in pages show **"Logged in as: {displayName}"** (from Entra ID via MSAL / mock session), with the **Sign out** control and (for admins) the **Admin Console** link moved from the footer into the header for quick access.
- **Save → Submissions** — After **Save draft** or **Submit record**, the composer now auto-switches to the **Submissions** list so users see the saved row in context.
- **Library → Submissions** — Tab renamed from *Library* to **Submissions** to match the record vocabulary used elsewhere.
- **True read-only for submitted records** — The rich-text legislation description (Tiptap) and department combobox now honour the read-only flag so submitted records cannot be silently edited; the helper copy now reads "Choose **Edit** below to make changes."
- **Edit button** — *Reopen for editing* renamed to **Edit** (matches admin detail page).
- **Top + bottom action bar** — Save / Submit / Print / Download PDF / Email buttons are duplicated at the **top** of the composer for long forms.
- **Unified PDF layout** — The server PDFKit fallback now mirrors the **Print document** layout (title, date, Legislation / Chapter / Goal / Policy labels, Description heading, How-furthers heading) so **Download PDF** and **Print document** produce the same document.
- **Admin — Print document fixed** — The Admin detail *Print document* button now actually prints (the hidden `.print-doc` is portalled to `document.body` so the print media query can show it).
- **Admin link placement** — Moved from the footer to the header (below the username) on the main app pages, matching the new identity bar.

## [3.4.0] — 2026-04-18

### Sprint 5 — Admin Console on the server

- **API** — `GET/PATCH /api/admin/submissions[/:id]` expose every submission across all owners. Guarded by **`isAdmin()`**: requires an Entra app role (default **`comp-plan-admin`**, override with **`ADMIN_ROLE_NAMES`**) **or** an email in **`ADMIN_EMAILS`** (comma-separated). List response includes **`ownerEmail`** for the admin UI.
- **Auth context** — `resolveOwner()` also returns **`roles`**. JWT mode reads from the `roles` claim; header mode accepts a new **`X-User-Roles`** header (CORS allowlisted) for mock/E2E callers.
- **Admin UI** — `admin.html` now boots MSAL (same config as the main SPA) and renders an **AdminAuthGate**: unauthenticated visitors see a sign-in screen, non-admins see a "not authorized" screen. Signed-in admins see live server data (per-submission `ownerEmail`, status pill); if the admin API is unavailable, the console falls back to seeded localStorage with a visible notice.
- **Env** — New server env: **`ADMIN_ROLE_NAMES`**, **`ADMIN_EMAILS`** (see [`.env.example`](.env.example)).

## [3.3.0] — 2026-04-17

### Sprint 4 — API authentication (Entra JWT)

- **Bearer tokens** — When **`AZURE_TENANT_ID`** and **`AZURE_AUDIENCE`** are set on the API, `/api/submissions*` resolves identity from a validated **`Authorization: Bearer`** JWT (JWKS from Entra). **`jose`** verifies issuer and audience.
- **Headers fallback** — If Azure env is **unset**, behavior matches earlier sprints (identity headers only). If Azure env **is** set, **`ALLOW_HEADER_IDENTITY=true`** restores header trust for migration, Playwright/e2e, or sandbox until scopes are wired.
- **SPA** — `acquireTokenSilent` adds the API scope (default **`api://{VITE_AZURE_CLIENT_ID}/access_as_user`**, override with **`VITE_API_SCOPE`**). Requests still send **`X-User-*`** when present.
- **CORS** — Allows **`Authorization`** on API requests.

## [3.2.0] — 2026-04-17

### Sprint 3 — Submission lifecycle

- **Status** — Each submission is **`draft`** or **`submitted`** with optional **`submittedAt`** (ISO timestamp). SQLite migration adds **`submitted_at`**.
- **API** — Create accepts optional **`status`**; **`PATCH`** can update **`snapshot`** and/or **`status`**. **`DELETE`** removes **draft** rows only (**409** if submitted).
- **Composer** — Save draft vs submit with preview modal; reopen submitted records; library shows status; PDF download and legislation mailto summary from saved rows.

## [3.1.0] — 2026-04-18

### Sprint 2 — Server-backed submissions (SQLite)

- **SQLite** — API stores submissions under `owner_key` (from `X-User-Oid` + `X-User-Email` headers). Default path `./data/submissions.sqlite`; override with **`SQLITE_PATH`** (see [`.env.example`](.env.example)).
- **REST** — `GET/POST /api/submissions`, `GET/PATCH/DELETE /api/submissions/:id` (body `{ snapshot }` for mutating calls). Register **`POST /api/submissions/pdf`** before dynamic `/api/submissions/:id` routes so `pdf` is not captured as an id.
- **SPA routes** — **`/app`** = signed-in home (list + **New action**); **`/app/compose`** = composer. Client [`submissionsApi.ts`](src/submissionsApi.ts) sends identity headers from [`auth.ts`](src/auth.ts) (JWT validation on the server is a later sprint).
- **Admin** — `admin.html` still reads **localStorage** via [`savedActionsStore.ts`](src/savedActionsStore.ts); it does not see server rows until a follow-up wires an admin API.
- **Tests** — CRUD coverage in [`server/app.test.ts`](server/app.test.ts) (in-memory DB per test). **Do not** send `Content-Type: application/json` on **DELETE** with an empty body (Fastify JSON parser returns 400).

## [3.0.0] — 2026-04-18

### Sprint 1 — Azure Entra ID sign-in and routing

- **React Router** — Public `/` landing, `/auth/callback` OAuth redirect, `/access-denied` for non–City accounts, protected `/app` for the composer + library ([`ComposerApp`](src/ComposerApp.tsx)).
- **MSAL** — `@azure/msal-browser` + `@azure/msal-react`: PKCE redirect flow; configure with `VITE_AZURE_CLIENT_ID`, `VITE_AZURE_TENANT_ID`, optional `VITE_AZURE_REDIRECT_URI` (see [`.env.example`](.env.example)).
- **Eligibility** — After sign-in, only emails whose domain is in `VITE_ALLOWED_EMAIL_DOMAINS` (default **`cabq.gov`**) may use `/app`; others are redirected to `/access-denied`.
- **Roles** — ID token `roles` claim mapped into [`auth.ts`](src/auth.ts); admin role names configurable via `VITE_ENTRA_ROLE_ADMIN`. **Admin Console** link in the composer footer only when [`isAdmin()`](src/auth.ts) is true (mock admin or matching Entra app role).
- **Development / E2E** — Without `VITE_AZURE_CLIENT_ID`, dev server shows **Mock city user** / **Mock admin** on the landing page. Production E2E uses [`vite build --mode e2e`](package.json) with [`.env.e2e`](.env.e2e) (`VITE_E2E_MOCK_AUTH=true`) so Playwright can click mock sign-in.
- **Docs** — [`docs/VERSIONING.md`](docs/VERSIONING.md), [`future_work.md`](future_work.md).
- **Tests** — [`src/auth/entraEligibility.test.ts`](src/auth/entraEligibility.test.ts).

## [2.0.0] — 2026-04-02

### Admin Console

- **New `/admin.html` entry point** — separate React app (multi-page Vite build via `rollupOptions.input`). Shares `src/` utilities, types, and localStorage with the main app.
- **Submissions list** — table of all submitted actions with columns: Record ID, Legislation Title, Department, Primary Contact, Policy, Date. Full-text search across name, department, legislation text, contacts, policies, and record IDs (multi-word AND matching).
- **Submission detail page** — view the complete submitted document. Actions: **Edit** (toggle inline editing for department, legislation title, legislation description, how-furthers text, contacts, plan items with cascading dropdowns), **Print document** (reuses `PrintPreview` component and `window.print()`), **Share link** (copies direct URL to clipboard), **Save changes** (persists edits to localStorage).
- **Hash-based routing** — `#` = list, `#submission/{id}` = detail. No extra dependencies; uses `hashchange` event.
- **Placeholder auth module** — `src/auth.ts` exports `loginAsAdmin()`, `logout()`, `isAdmin()`, `getAuthUser()` with a `comp-plan-admin` role. `src/useAuth.ts` provides a React hook via `useSyncExternalStore`. Ready for SSO (SAML/OIDC) integration.
- **Admin link** in main app footer (`/admin.html`); visible to all users for now (role gating pending SSO).
- **Test seed data** — `src/admin/seedTestData.ts` generates **48 realistic submissions** across **24 departments** on first admin page load. Each has unique legislation title, detailed description, named contacts, and valid plan hierarchy selections. Remove before production.
- **Admin CSS** — `src/admin/admin.css` with dark header, wider layout (68rem), clickable table rows, edit forms, contact fieldsets, responsive breakpoints.

### Vite config

- Multi-page build: `build.rollupOptions.input` includes both `index.html` and `admin.html`.

### Print

- `@media print` now hides `.admin-shell` alongside `.app-shell`.

## [1.2.0] — 2026-04-02

- **Print document button** — new button in form actions opens the browser print dialog. Maps 11 fields from the form to a structured print layout matching the Word template: Date, Department, Legislation Title, Chapter Number/Description, Goal/Description, Policy/Description, Legislation Description, How Furthers. Uses `PrintPreview` component (hidden on screen, visible during `@media print`) and `printFields.ts` for field extraction.
- **`@page { margin: 0 }`** suppresses Chrome's default print headers/footers (date, URL, page numbers).
- Removed city seal, city/department/mayor header lines from print output per user request.

## [1.1.0] — 2026-03-31

- **Word template PDF** — `POST /api/submissions/pdf` merges into **`comp plan print template.docx`** (see `server/templates/`, Desktop path, or `COMP_PLAN_DOCX_TEMPLATE`) using **docxtemplater**, then converts to PDF with **Libreoffice-convert** (requires LibreOffice installed). XML preprocessing fixes placeholders Word split across runs; chapter/goal/policy combined lines split into number + description for `{Chapter Number}` / `{Chapter Description}` (etc.). **PDFKit** fallback when the template or conversion is unavailable.
- **Milestone baseline** — Versioning starts at **1.1.0** for rollback (`v1.1.0` tag). Future work iterates **1.1.x** until the next minor/major bump.
- **User-facing form** — Tab and UI renamed from **Composer** to **Comprehensive Plan**. **Save for later** (draft flush + optional library update when editing) and **Submit** (validated save + PDF download) at **top and bottom** of the form. Removed Clear, Copy/Download JSON, Print, and library **Export all (JSON)**.
- **PDF** — `POST /api/submissions/pdf` generates a letter-size PDF (pdfkit) with merge fields aligned to the Word template placeholders: `{current date}`, `{legislation title}`, `{chapter}`, `{goal}`, `{policy}`, `{legislation description}`, `{How does this legislation further the policies selected?}`.
- **Record IDs** — Each library row has a **`CP-######`** id (six digits); existing stored rows migrate on load.
- **Library** — Renamed to **Your submissions** in the UI; table includes **Record** column.
- **Header** — Stronger contrast for title, lede, and links on the navy gradient.
- **API** — `GET /api/health` `version` is read from `package.json`.
- **E2E** — `npm run e2e:serve` runs API + `vite preview` with `/api` proxy; Playwright uses it for Submit + PDF.
- **Docs** — `docs/ARCHITECTURE.md` (user app vs future admin); `src/admin/README.md` placeholder.
- **Fix** — Footer on loading and error shells so version is always visible; React hooks order (editing label `useMemo` before conditional returns).

## [0.11.4] — 2026-04-02

- **Department** is **required** for save and export: validation error **Enter a department.** if blank; combobox shows **(required)** and updated placeholder.
- **API:** `GET /api/health` `version` **0.11.4**.

## [0.11.3] — 2026-04-02

- **Labels:** **Action title** → **Legislation title**; **Action description** → **Legislation description**; section heading **Legislation details**.
- **New field:** **How does this legislation further policies selected?** — required plain-text area, **10–1000** characters (stored as `howFurthersPolicies`, included in JSON export).
- **Validation messages** updated to use “legislation” wording where applicable. **Library** table column **Legislation title**.

## [0.11.2] — 2026-04-02

- **Composer:** Choosing a **Goal** automatically selects the first **Goal detail** for that goal (users can still change goal detail afterward).
- **Action description:** Plain-text maximum increased to **2500** characters; the live character counter was removed (validation unchanged otherwise).
- **Attachments removed** from the UI, draft snapshot, library records, and export JSON (`attachments` field removed from export payload). Legacy drafts with stored attachments ignore attachment data on load.
- **API:** `GET /api/health` `version` updated to **0.11.2** (keep in sync with `package.json` when releasing).

## [0.11.1] — 2026-04-02

- **Docs / process:** Added **`agent.md`** (release and build checklist: version bump, `npm run build` / `test` / `lint` / `test:e2e`, update **`CHANGELOG.md`** and **`change.md`**, push to GitHub including **`v0.11.1`** tag, open **`npm run preview`** in the browser). Added **`change.md`** as a short “current release” summary; full history stays here.

## [0.11.0] — 2026-03-31

- **Multiple comprehensive plan items:** The composer supports **one or more** hierarchy rows per action. Use **Add another plan item** to append a row; **Remove** appears when there is more than one row. Hierarchy search applies to the row you last focused (highlighted). Saved draft JSON and library entries store `planItems` (legacy flat `chapterIdx` / … fields in stored JSON are migrated to `planItems[0]` on load).
- **Export JSON (breaking):** Root `chapter` / `goal` / `policy` / … fields are replaced by **`compPlanItems`**, an array of hierarchy objects in composer order. Downstream consumers should read `compPlanItems` (and handle length ≥ 1).

## [0.10.0] — 2026-04-01

- **Workflow feature shelved (not deleted):** The full workflow stack is **copied to `archive/workflow-shelved/`** with restore instructions. The live app drops the **Workflow** tab, **Submit to workflow**, and **`#/fi/...`** department view. The running API is **minimal** (`GET /api/health` with `{ workflow: "shelved" }`) so `dev:server` / Vite `/api` proxy still work.
- **Removed** from the active tree: Drizzle/SQLite workflow server, demo seed script, `drizzle.config.ts`, `scripts/gen-workflow-plan.mjs` (archived copy kept). **Dependencies** trimmed (no `better-sqlite3`, `drizzle-orm`, `docx`, `uuid`, `zod` in the default install).
- **E2E:** Smoke test no longer opens the Workflow tab.

Restore workflow from Git tag **`v0.9.0`** or from `archive/workflow-shelved/` — see `archive/workflow-shelved/README.md`.

## [0.9.0] — 2026-04-01

**First iteration complete** — milestone release: composer (rich action description, validation), local library, workflow API (SQLite), staff inboxes, FI department link, Word placeholder export, Playwright E2E, demo workflow seed, and toolchain upgrades (Vite 8, Vitest 4, TypeScript 6, React 19.2, TipTap).

- Bumps app and API health version to **0.9.0**.
- **`WORKFLOW_DEMO_SEED` on startup** is skipped when Vitest or `NODE_ENV=test` runs the API, so unit tests stay fast and reliable.

## [0.8.6] — 2026-04-01

- **Demo workflow seed:** `npm run seed:demo` inserts **30** submissions — **5** per workflow position: Planning review, Planning (after council review), City Council review, Further information (requested by Planning), Further information (requested by Council), and Complete. Rows use ids prefixed with `demo-` (re-seeding clears previous demo rows). Optional: start the API with `WORKFLOW_DEMO_SEED=1` to seed on startup.
- API **GET /api/health** `version` field updated to **0.8.6**.

## [0.8.5] — 2026-04-01

### Stage A — Toolchain (latest stable where compatible)

- **Vite 8**, **Vitest 4**, **TypeScript 6**, **React 19.2**, **@vitejs/plugin-react 6**, **@fastify/cors 11**, **typescript-eslint 8.58**, **globals 17**, **ESLint 9.39** + **eslint-plugin-react-hooks 7**. (ESLint 10 is not used yet: `eslint-plugin-react-hooks` still peers ESLint `^9` only.)
- Removed **`@types/uuid`** (uuid ships its own types; the `@types` package is deprecated).
- **Department combobox:** reset highlight without `setState` inside `useEffect` (satisfies new `react-hooks/set-state-in-effect` rule).

### Stage B — Browser verification

- **Playwright** (Chromium) end-to-end tests: `npm run test:e2e` runs **`npm run build`** then **`vite preview`** and exercises shell, tabs, hierarchy + save to library, department combobox, and TipTap bold. Use `npm run test:e2e:ui` for the Playwright UI runner.
- Preview URL for manual checks: after `npm run build`, run `npm run preview` and open the URL shown (default **http://localhost:4173**).

## [0.8.3] — 2026-03-31

- **Fix (React 19):** Replaced **react-quill** with **TipTap** for the action description editor. `react-quill` relied on `ReactDOM.findDOMNode`, which was removed in React 19 and caused *“Something went wrong”* / `findDOMNode is not a function` at runtime. Behavior is unchanged: HTML storage, plain-text validation, toolbar (headings, bold/italic/underline, lists, links, clear).

## [0.8.2] — 2026-03-31

- **Action title** and **Action description** (renamed from “Describe the departmental action”) are **required** for save, JSON export, and workflow submit. Validation uses **plain-text length** after stripping rich text markup (max **500** characters of plain text).
- **Action description** is a **rich text** field (Quill toolbar: headings, bold/italic/underline, lists, links). Character counts and limits apply to plain text, not raw HTML.
- Word export (Complete) writes plain text for the description column.

## [0.8.1] — 2026-04-01

- **Department** field uses the City of Albuquerque department list (sorted A–Z) with a **combobox**: type to filter, click **▾** or focus to open the full list, keyboard arrows + Enter. Custom text is still allowed if there is no match.

## [0.8.0] — 2026-04-01

### Product

- **Workflow API (Fastify + SQLite):** Submit validated forms to a server-side repository (`POST /api/submissions`). **Workflow** tab: mock staff login (seed users), inbox by role (Planning sees all; City Council sees council queue), transitions, comments for FI / Council→Planning, department FI link (`#/fi/:token`), rough **Word** download on Complete.
- **Notifications:** Rows stored in DB + console `[NOTIFICATION]` log (SMTP later).

### Engineering

- `server/` — Drizzle ORM, `workflow/engine.ts` state machine, `data/workflow.db` (override with `WORKFLOW_DB_PATH`). **`workflow_plan.docx`** generated via `node scripts/gen-workflow-plan.mjs`.
- **Dev:** `npm run dev:server` (port 8787), `npm run dev:all` (API + Vite); Vite proxies `/api` to the API.

## [0.7.1] — 2026-03-31

- **Save / export validation:** **Primary contact** (name, role, email, phone) is required: valid-looking email and at least **7 digits** in the phone field. **Plan selection** must reach **policy** (chapter → goal → goal detail → policy). Sub-policy and sub-policy sub-level are **optional** for save and JSON export.
- UI: primary contact labels show **(required)** and `aria-required` for accessibility.

## [0.7.0] — 2026-03-31

### Product

- **Action details:** **Action title** moved here (was “Record title” in Record). **Describe the departmental action** capped at **500 characters** with a live counter. **Attachments:** multiple uploads with allowlisted business document and image types, size limits, and blocks on executables, scripts, and risky extensions (see `attachmentPolicy.ts`).
- **Contact Information** (section renamed from Record): **Department** field (was “Department / division”). **Primary** and **Alternate** contact blocks (name, role, email, phone). Removed **Internal reference #**.

### Engineering

- Draft snapshot and JSON export include `actionTitle`, `primaryContact`, `alternateContact`, `attachments`; legacy `title` in stored drafts migrates to `actionTitle`.

## [0.6.2] — 2026-04-01

- Section title **Comprehensive Plan Items** (replaces abbreviated “Compl Plan Items”).
- Chapter placeholder text **Select chapter...** (ASCII ellipsis).
- **Default hierarchy:** On load, the composer always starts with **Select chapter...** (no chapter pre-selected). Browser draft still restores record title, department, reference #, and action details only; library **Edit** still loads full hierarchy from a saved record.

## [0.6.1] — 2026-04-01

- UI copy: section title **Compl Plan Items** (was “Plan hierarchy”); search label **Search Comprehensive Plan** (was “Find in plan”).

## [0.6.0] — 2026-04-01

- **Plan search:** Every index row’s `searchBlob` now concatenates **chapter → goal → goal detail → policy → sub-policy → sub-level** text with null-safe field normalization (`searchText.ts`), so every level is explicitly indexed—not only leaf text.
- **Ranking:** Replaced “specificity bonus” (which buried chapter/goal/policy hits under sub-level rows sharing the same ancestor text) with **round-robin interleaving** by level: one best match per level per round, iterating chapter → goal → goal detail → policy → sub-policy → sub-level. Within each level, earlier token matches in the blob still rank higher.
- **Tests:** `searchText`, `buildPlanSearchIndex` ancestor-chain coverage, `searchPlan` diversity + `tokenScore` unit tests.

## [0.5.1] — 2026-03-31

- **Fix:** Sub-policy sub-level rows in the plan JSON may contain `roman: null` (Excel export). `subLevelLabel` no longer calls `.trim()` on null; `SubLevel` types allow null fields. Resolves runtime error: “Cannot read properties of null (reading 'trim')”.

## [0.5.0] — 2026-03-31

- **Plan hierarchy search:** Full-text style search across chapters, goals, goal details, policies, sub-policies, and sub-levels. Multi-word queries use AND matching (all words must appear). Results are ranked by match position and specificity; choosing a result jumps all cascaded dropdowns to that node without changing record metadata or action text.
- **Tests:** `buildPlanSearchIndex`, `searchPlan`, and integration coverage.

## [0.4.0] — 2026-03-31

**Review-ready release:** library, validation, exports, tooling.

### Product

- **Library:** Multiple saved action records in the browser; Composer vs Library tabs; edit, duplicate, delete; search filter; **Export all** downloads one JSON bundle (`records[]`).
- **Record metadata:** Title (required to save), optional department/division and internal reference ID; included in all JSON exports.
- **Validation:** Save requires title (≥3 characters), action description (≥10 characters), and a complete hierarchy including sub-policy and sub-level when the plan data requires them. Copy/download JSON validates hierarchy only (no title length rule).
- **UX:** Print-friendly summary (**Print summary**); error boundary; civic styling and responsive layout refinements.

### Engineering

- ESLint 9 (flat config) with TypeScript and React Hooks rules (`npm run lint`).
- GitHub Actions: `npm ci`, lint, test, build on push/PR to `master`.
- `buildActionRecordFromSnapshot()` centralizes export shape.

## [0.2.0] — 2026-03-31

- Local draft auto-save and JSON copy/download.

## [0.1.0] — 2026-03-31

- Initial prototype: cascading plan hierarchy and action details.
