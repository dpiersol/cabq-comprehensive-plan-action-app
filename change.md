# Current release summary

**Version:** 3.5.0  
**Date:** 2026-04-18

## What changed

- **v3.5.0 — UX polish.** Header shows **"Logged in as: {name}"** + **Sign out** + **Admin Console** (moved from footer). Save / Submit redirect to the **Submissions** tab (renamed from *Library*). Submitted records are now genuinely read-only (Tiptap + department combobox). *Reopen for editing* renamed to **Edit**. Composer action buttons are replicated at the **top** of the form. Server PDFKit fallback now mirrors the Print document layout so **Download PDF** and **Print document** produce the same output. Admin console **Print document** fixed (the hidden print layer is portalled outside `.admin-shell`).
- **Sprint 5 (v3.4.0) — Admin on the server.** New `/api/admin/submissions` endpoints list/patch all users' rows, guarded by **`ADMIN_ROLE_NAMES`** (default **`comp-plan-admin`**) **or** **`ADMIN_EMAILS`**. `admin.html` now requires MSAL sign-in + admin role, shows per-submission **`ownerEmail`** and status pills, and falls back to seeded localStorage with a notice when the API is unavailable. Auth context also carries **`roles`** (JWT claim or **`X-User-Roles`** header).
- **Sprint 4 (v3.3.0) — API JWT.** Server can validate **Entra access tokens** (`Authorization: Bearer`) using **`AZURE_TENANT_ID`** / **`AZURE_AUDIENCE`**; optional **`ALLOW_HEADER_IDENTITY=true`** keeps **`X-User-*`** trusted when migrating or before API scope consent. Client acquires **`VITE_API_SCOPE`** (default **`access_as_user`**) via MSAL silent token when configured.
- **Sprint 3 (v3.2.0) — Lifecycle.** Submissions carry **`draft` / `submitted`** status and **`submittedAt`**. API supports transitions and blocks deleting submitted rows. Composer: preview before submit, reopen, PDF download and email summary from the library.
- **Sprint 2 (v3.1.0) — Persistence.** Main app submissions live in **SQLite** via **`/api/submissions`** (Fastify). Routes: **`/app`** home (table), **`/app/compose`** composer. **`admin.html`** still uses localStorage until wired.
- **Sprint 1 (v3.0.0) — Entra ID + routes.** Public **landing** with **Sign in with Microsoft** (Azure Entra); **only @cabq.gov** (or `VITE_ALLOWED_EMAIL_DOMAINS`) may use the app after sign-in. See [`.env.example`](.env.example) and [`docs/VERSIONING.md`](docs/VERSIONING.md).

See **`CHANGELOG.md`** for the full history. Release steps: **`agent.md`**.
