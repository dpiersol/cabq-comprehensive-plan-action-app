# Current task

> Update this file when the active task or ownership changes. Keep it short.

## Active branch

`master`

## Owner

Unassigned

## Goal

Ship v2.0.0 with the Admin Console; prepare for SSO integration and production deployment.

## In scope

- App source (`src/`), admin console (`src/admin/`), `public/data/`, tests.
- Regenerating hierarchy JSON from Excel when the plan table changes (`npm run data`).
- Admin console: submissions list, detail/edit, search, print, share.

## Out of scope / do not touch

- **`archive/workflow-shelved/`** unless restoring or documenting the shelved workflow (see README + tag `v0.9.0`).

## Status — v2.0.0 delivered

- Admin console complete: list, detail, edit, print, share.
- Placeholder auth module (`auth.ts` / `useAuth.ts`) with `comp-plan-admin` role.
- 48 seeded test submissions across 24 departments.
- All 55 tests pass, zero lint errors, zero build errors.
- Multi-page Vite build: `index.html` (main app) + `admin.html` (admin console).

## Next steps

- **SSO integration** — Replace placeholder auth with real SAML/OIDC provider.
- **Backend persistence** — Move localStorage submissions to a server-side database for multi-user admin access.
- **Role gating** — Hide the Admin Console link unless the user has `comp-plan-admin` role.
- **Remove seed data** — Strip `seedTestData.ts` before production deployment.

## Links

- Issue: <!-- URL or #123 -->
- PR: <!-- URL or #456 -->

## Recent activity (from Git)

- **v2.0.0:** Admin Console — submissions list with search, detail/edit page, print, share, placeholder auth, 48 seeded test submissions.
- **v1.2.0:** Print document button maps 11 Word template fields to browser print dialog.
- **v1.1.0:** Baseline — Submit saves to library, PDF API, record IDs.

## Last updated

2026-04-02
