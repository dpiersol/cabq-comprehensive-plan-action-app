# Current release summary

**Version:** 2.0.0  
**Date:** 2026-04-02

## What changed

- **v2.0.0 — Admin Console.** New `/admin.html` entry point with its own React app (multi-page Vite build). Admins see **all submissions** in a searchable table (name, department, legislation text, contacts, policies, record ID). Click any row to view the full submission, then **Edit** (contacts, legislation details, plan items), **Print document**, or **Share link**. Placeholder **auth module** (`auth.ts` / `useAuth.ts`) with role-based `comp-plan-admin` — ready for SSO integration later.
- **Test seed data** — 48 realistic submissions across 24 departments auto-populate on first admin page load (removable in production).
- **Admin link** added to the main app footer.
- **v1.2.0 — Print document** (previous release). Browser print dialog maps 11 Word template fields; `@page { margin: 0 }` suppresses Chrome headers/footers.

See **`CHANGELOG.md`** for the full history. Release steps: **`agent.md`**.
