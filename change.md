# Current release summary

**Version:** 3.3.0  
**Date:** 2026-04-17

## What changed

- **Sprint 4 (v3.3.0) — API JWT.** Server can validate **Entra access tokens** (`Authorization: Bearer`) using **`AZURE_TENANT_ID`** / **`AZURE_AUDIENCE`**; optional **`ALLOW_HEADER_IDENTITY=true`** keeps **`X-User-*`** trusted when migrating or before API scope consent. Client acquires **`VITE_API_SCOPE`** (default **`access_as_user`**) via MSAL silent token when configured.
- **Sprint 3 (v3.2.0) — Lifecycle.** Submissions carry **`draft` / `submitted`** status and **`submittedAt`**. API supports transitions and blocks deleting submitted rows. Composer: preview before submit, reopen, PDF download and email summary from the library.
- **Sprint 2 (v3.1.0) — Persistence.** Main app submissions live in **SQLite** via **`/api/submissions`** (Fastify). Routes: **`/app`** home (table), **`/app/compose`** composer. **`admin.html`** still uses localStorage until wired.
- **Sprint 1 (v3.0.0) — Entra ID + routes.** Public **landing** with **Sign in with Microsoft** (Azure Entra); **only @cabq.gov** (or `VITE_ALLOWED_EMAIL_DOMAINS`) may use the app after sign-in. See [`.env.example`](.env.example) and [`docs/VERSIONING.md`](docs/VERSIONING.md).

See **`CHANGELOG.md`** for the full history. Release steps: **`agent.md`**.
