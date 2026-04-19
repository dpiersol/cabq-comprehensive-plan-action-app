# Changelog

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
