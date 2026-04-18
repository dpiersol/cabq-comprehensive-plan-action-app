# Current release summary

**Version:** 3.2.0  
**Date:** 2026-04-17

## What changed

- **Sprint 3 (v3.2.0) — Lifecycle.** Submissions carry **`draft` / `submitted`** status and **`submittedAt`**. API supports transitions and blocks deleting submitted rows. Composer: preview before submit, reopen, PDF download and email summary from the library.
- **Sprint 2 (v3.1.0) — Persistence.** Main app submissions live in **SQLite** via **`/api/submissions`** (Fastify). Routes: **`/app`** home (table), **`/app/compose`** composer. Identity headers **`X-User-Oid`** / **`X-User-Email`** from the signed-in session (JWT on API is future work). **`admin.html`** still uses localStorage until wired.
- **Sprint 1 (v3.0.0) — Entra ID + routes.** Public **landing** with **Sign in with Microsoft** (Azure Entra); **only @cabq.gov** (or `VITE_ALLOWED_EMAIL_DOMAINS`) may use the app after sign-in. **MSAL** + **React Router**; **Admin Console** link when [`isAdmin()`](src/auth.ts). **Mock sign-in** for local dev when Azure env vars are unset. See [`.env.example`](.env.example) and [`docs/VERSIONING.md`](docs/VERSIONING.md).
- **v2.0.0 — Admin Console** (unchanged). `/admin.html` for all-submissions admin UI; test seed data on first visit; `future_work.md` for multi-tenant and extra roles.
- **v1.2.0 — Print document** (earlier). Browser print maps 11 Word template fields; `@page { margin: 0 }` for Chrome.

See **`CHANGELOG.md`** for the full history. Release steps: **`agent.md`**.
