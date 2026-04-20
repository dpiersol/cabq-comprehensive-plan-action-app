# Current task

> Update this file when the active task or ownership changes. Keep it short.

## Active branch

`develop` — v3.3.0 shipped (Sprint 4 API JWT + Sprint 3 lifecycle merged).

## Owner

Unassigned

## Goal

City user submission flows with secure API; admin/reporting follow in later phases (see `future_work.md`).

## In scope

- App source (`src/`), admin console (`src/admin/`), `public/data/`, API `server/`, tests.

## Out of scope / do not touch

- **`archive/workflow-shelved/`** unless restoring or documenting the shelved workflow (see README + tag `v0.9.0`).

## Status

- **v3.3.0** — Optional Entra JWT validation on API; MSAL silent scope for Bearer; header fallback via **`ALLOW_HEADER_IDENTITY`** when Azure env is set.
- **v3.2.0** — Draft/submitted lifecycle, preview submit, reopen, PDF/mailto from library.
- **v3.1.0** — SQLite-backed submissions; **`/app`** / **`/app/compose`**.
- Admin Console (`admin.html`) still **localStorage** — not synced with server rows.

## Next steps

- Entra **Expose an API** + user consent for **`access_as_user`** on each environment; set **`AZURE_*`** on the server and remove **`ALLOW_HEADER_IDENTITY`** when ready.
- Optional: wire **admin** to a protected admin API.

## Links

- Issue: <!-- URL or #123 -->
- PR: <!-- URL or #456 -->

## Last updated

2026-04-17
