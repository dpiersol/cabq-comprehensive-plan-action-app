# Shelved workflow stack (reference copy)

This folder preserves the **Fastify + SQLite + Drizzle workflow API**, staff **Workflow** UI, **FI department** response screen, **Playwright** specs that exercised the Workflow tab, and related scripts — as they existed when the feature was shelved.

The **live app** no longer imports these modules; the running server is a minimal **`GET /api/health`** stub so `npm run dev:server` / Vite’s `/api` proxy still work.

## What is here

| Path | Notes |
|------|--------|
| `server/` | Full workflow server (`app.ts`, `workflow/`, `db/`, `services/`, `validation/`, etc.) |
| `src/api/workflowApi.ts` | Client API helpers |
| `src/components/WorkflowPanel.tsx` | Staff workflow tab |
| `src/components/FiDepartmentRespond.tsx` | `#/fi/:token` department view |
| `e2e/` + `playwright.config.ts` | E2E that included Workflow tab navigation |
| `drizzle.config.ts` | Drizzle kit config (if present) |
| `gen-workflow-plan.mjs` | Doc generator for `workflow_plan.docx` (needs `docx` package) |

## Restore later (pick one)

1. **From Git tag (recommended)** — full tree at first-iteration release:
   ```bash
   git checkout v0.9.0 -- server src/api/workflowApi.ts src/components/WorkflowPanel.tsx src/components/FiDepartmentRespond.tsx
   git checkout v0.9.0 -- e2e playwright.config.ts drizzle.config.ts scripts/gen-workflow-plan.mjs package.json package-lock.json
   ```
   Then reconcile with any form changes made on `main` after the shelf.

2. **From this archive** — copy folders/files back into the repo root (same paths as above), merge `package.json` dependencies from tag `v0.9.0`, and run `npm install`.

## Git reference

- Tag: **`v0.9.0`** — last release with workflow fully wired before shelving.
