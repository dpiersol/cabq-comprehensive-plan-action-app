# CABQ Comprehensive Plan Action Application

Internal application for documenting departmental actions against the Albuquerque / Bernalillo County (ABC) Comprehensive Plan hierarchy (chapter → goal → goal detail → policy → sub-policy → optional sub-level), with **cascading dropdowns** and structured exports.

- **Stack:** React 19, TypeScript, Vite 6, Vitest, ESLint 9; **workflow API** — Fastify 5, Drizzle ORM, SQLite (`data/workflow.db`).
- **Data:** `public/data/comprehensive-plan-hierarchy.json` (generated from `comprehensive plan table.xlsx` via `scripts/excel_to_hierarchy.py`)
- **Storage:** Browser `localStorage` for drafts and **Library**; **workflow** submissions and audit in SQLite when the API runs. Draft restores contact fields, action title, attachments, and action text on reload, not the plan hierarchy (each visit starts at **Select chapter...** until you pick or search). Mock staff auth only until SSO.

## Setup

```bash
npm install
npm run dev
# Optional: app + API together (workflow submit & Workflow tab)
npm run dev:all
```

Open the URL shown in the terminal (typically `http://localhost:5173`). The API listens on **8787**; in dev, Vite proxies `/api` to it when using `dev:all` or with `dev:server` running separately.

Environment: **`WORKFLOW_DB_PATH`** — optional path to the SQLite file (default `./data/workflow.db`).

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Vite dev server only |
| `npm run dev:server` | Workflow API (SQLite, port 8787) |
| `npm run dev:all` | API + Vite (concurrently) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run test` | Unit tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run data` | Regenerate JSON from Excel (edit paths in script if needed) |

## Features (review scope)

1. **Composer** — Cascading selects; **Search Comprehensive Plan** across the full plan text (chapter through sub-level) with level-balanced results; jump the hierarchy without knowing the full path; current selection summary; **Contact Information** (department, primary and alternate contacts); **Action details** (action title, narrative up to 500 characters, optional attachments — business documents and images only).
2. **Library** — Save many records locally; open for edit; duplicate; delete; filter; export all as one JSON file.
3. **Export** — Single-record JSON (Copy / Download) or bundle export from Library. Schema includes `actionTitle`, `department`, `primaryContact`, `alternateContact`, `attachments`, plan nodes, and `actionDetails`.
4. **Print** — Use **Print summary** for a clean printout (toolbar hidden via CSS).
5. **Workflow (v0.8+)** — **Submit to workflow** on the composer (API must be running). **Workflow** tab for staff (mock users from seed). See **`workflow_plan.docx`** at the repo root for the process narrative.

## Review checklist (stakeholder demo)

- [ ] Use **Search Comprehensive Plan** with a policy number and with a multi-word phrase; confirm results jump the dropdowns correctly.
- [ ] Walk through full hierarchy for one chapter (e.g. Chapter 4) through at least **policy** (sub-policy / sub-level optional for save).
- [ ] Confirm validation when saving with missing action title, short action text, incomplete **primary contact**, or plan not selected through policy.
- [ ] Save at least two library entries, filter, edit one, duplicate one, delete one.
- [ ] Export a single JSON and confirm fields match the on-screen selection.
- [ ] Use **Export all** and confirm `records` array length matches the library.
- [ ] Print preview from **Print summary** looks acceptable for internal filing.

## Deploying static build

`npm run build` emits `dist/`. Host `dist/` on any static file host (HTTPS). The app loads plan data from `/data/comprehensive-plan-hierarchy.json` relative to the site root—configure the host so that path is served, or adjust `vite.config.ts` `base` if deploying under a subpath.

## Regenerating data

Point `scripts/excel_to_hierarchy.py` at your Excel export, then:

```bash
python scripts/excel_to_hierarchy.py
```

## References

- [ABC Comprehensive Plan — City of Albuquerque](https://www.cabq.gov/planning/plans-publications/abc-comprehensive-plan)
- [Interactive Comprehensive Plan](https://compplan.abq-zone.com/)

## Version

Current release: **v0.9.0** — see `CHANGELOG.md`.

**Workflow demo data:** with the API running against a local DB, run **`npm run seed:demo`** to insert 30 sample submissions (5 per workflow step). To seed automatically when the server starts, set **`WORKFLOW_DEMO_SEED=1`**. Demo rows have ids starting with **`demo-`**; re-running the seed script removes previous demo rows before inserting.

**Quality checks:** `npm test` (Vitest), `npm run lint`, `npm run build`, `npm run test:e2e` (Playwright against production preview; installs Chromium via Playwright on first run).
