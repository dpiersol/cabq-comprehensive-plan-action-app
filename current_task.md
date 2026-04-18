# Current task

> Update this file when the active task or ownership changes. Keep it short.

## Active branch

`feature/sprint1-entra-routing` (merge to `develop` when ready)

## Owner

Unassigned

## Goal

Execute the product plan: Entra ID, user submission flows, admin, templates, reports (see `future_work.md` and product plan in chat / internal docs).

## In scope

- App source (`src/`), admin console (`src/admin/`), `public/data/`, API `server/`, tests.
- **Sprint 1 (v3.0.0) done:** MSAL + React Router + landing + `/app` guard + `cabq.gov` domain check + role-based admin link.
- **Next (Sprint 2):** server-backed submissions, user home list, per-user data (see plan).

## Out of scope / do not touch

- **`archive/workflow-shelved/`** unless restoring or documenting the shelved workflow (see README + tag `v0.9.0`).

## Status

- **v3.0.0** — Entra sign-in (or dev mock), `docs/VERSIONING.md`, `future_work.md`, E2E uses `build:e2e` + mock sign-in.
- Admin link in composer footer only if `isAdmin()`; still use `admin.html` (separate bundle) for now.
- 57 unit tests, 6 Playwright tests, lint clean.

## Next steps

- Merge `feature/sprint1-entra-routing` → `develop` (PR), then **Sprint 2** (persistence + user landing list).
- **Entra app registration** — set `VITE_AZURE_CLIENT_ID`, `VITE_AZURE_TENANT_ID`, redirect URI `https://<host>/auth/callback`, optional app roles for admin.
- **Remove or guard** `seedTestData` before production.

## Links

- Issue: <!-- URL or #123 -->
- PR: <!-- URL or #456 -->

## Last updated

2026-04-18
