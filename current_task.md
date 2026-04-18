# Current task

> Update this file when the active task or ownership changes. Keep it short.

## Active branch

`feature/sprint2-submissions-api` — merge when ready (after Sprint 1 PR or rebased on `develop`)

## Owner

Unassigned

## Goal

Execute the product plan: Entra ID, user submission flows, admin, templates, reports (see `future_work.md`).

## In scope

- App source (`src/`), admin console (`src/admin/`), `public/data/`, API `server/`, tests.

## Out of scope / do not touch

- **`archive/workflow-shelved/`** unless restoring or documenting the shelved workflow (see README + tag `v0.9.0`).

## Status

- **v3.1.0** — SQLite-backed `/api/submissions`; `/app` home + `/app/compose`; identity headers from MSAL/mock user.
- Admin Console (`admin.html`) still **localStorage** — not synced with server rows yet.

## Next steps

- Merge feature branches → `develop`; optional tag **`v3.1.0`**.
- **Sprint 3** — lifecycle (draft/review/complete), richer email/print UX per plan.
- **API auth** — validate Entra JWT on mutating routes; remove trust in headers alone for production.

## Links

- Issue: <!-- URL or #123 -->
- PR: <!-- URL or #456 -->

## Last updated

2026-04-18
