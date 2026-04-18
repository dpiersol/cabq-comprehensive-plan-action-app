# Current release summary

**Version:** 3.0.0  
**Date:** 2026-04-18

## What changed

- **Sprint 1 (v3.0.0) — Entra ID + routes.** Public **landing** with **Sign in with Microsoft** (Azure Entra); **only @cabq.gov** (or `VITE_ALLOWED_EMAIL_DOMAINS`) may use the app. The main form and library live at **`/app`** after sign-in. **MSAL** + **React Router**; **Admin Console** link in the composer footer only for users with a configured admin app role. **Mock sign-in** for local dev when Azure env vars are unset. See [`.env.example`](.env.example) and [`docs/VERSIONING.md`](docs/VERSIONING.md).
- **v2.0.0 — Admin Console** (unchanged). `/admin.html` for all-submissions admin UI; test seed data on first visit; `future_work.md` for multi-tenant and extra roles.
- **v1.2.0 — Print document** (earlier). Browser print maps 11 Word template fields; `@page { margin: 0 }` for Chrome.

See **`CHANGELOG.md`** for the full history. Release steps: **`agent.md`**.
