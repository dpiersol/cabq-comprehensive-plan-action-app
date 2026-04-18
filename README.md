# CABQ Comprehensive Plan Action Application

Internal application for documenting departmental actions against the Albuquerque / Bernalillo County (ABC) Comprehensive Plan hierarchy (chapter → goal → goal detail → policy → sub-policy → optional sub-level), with **cascading dropdowns** and structured exports.

- **Stack:** React 19, TypeScript, Vite 8, Vitest, ESLint 9; **API** — Fastify 5 with `GET /api/health` and `POST /api/submissions/pdf`. Vite **dev** and **preview** proxy `/api` when the server runs.
- **Multi-page build:** `index.html` (user app) + `admin.html` (admin console). Both share `src/` utilities and localStorage.
- **Data:** `public/data/comprehensive-plan-hierarchy.json` (generated from `comprehensive plan table.xlsx` via `scripts/excel_to_hierarchy.py`)
- **Storage:** Browser `localStorage` for drafts and **Library**. Draft restores contact fields, action title, attachments, and action description on reload, not the plan hierarchy (each visit starts at **Select chapter...** until you pick or search).

**Workflow shelved:** The previous Fastify + SQLite workflow (submit, staff inboxes, FI links, Word export) is **preserved under `archive/workflow-shelved/`** and restorable from Git tag **`v0.9.0`**. See `archive/workflow-shelved/README.md`.

## Setup

```bash
npm install
# Front end only (Submit + Print document work without the API):
npm run dev
# Optional: API + Vite together (for `POST /api/submissions/pdf` integrations / tests):
npm run dev:all
# Or: two terminals — npm run dev:server  (port 8787)  and  npm run dev  (port 5173)
```

Open the URL Vite prints (typically `http://localhost:5173`). You will see a **Sign in** landing page. **Sign in with Microsoft** uses **Azure Entra ID** (configure `VITE_AZURE_CLIENT_ID` and `VITE_AZURE_TENANT_ID` in `.env` — see [`.env.example`](.env.example)). If those are not set, the app offers **Mock city user** / **Mock admin** for local development. After sign-in, the form and library are at **`/app`**. **Submit** saves to the library and does **not** require the API. **Print document** uses the browser print dialog (no server). The PDF API on **8787** remains available for other callers (`POST /api/submissions/pdf`); in development, `src/apiConfig.ts` can target **`http://127.0.0.1:8787`** when the server runs. Production builds use same-origin `/api/...`. Optional: set **`VITE_API_ORIGIN`** if the API is not on 8787.

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Vite dev server only (default port **5173**) |
| `npm run dev:uiux` | Vite on port **5175** — use while on branch `ui-ux-improvements` so it never clashes with default dev |
| `npm run dev:develop` | Vite on port **5176** — use while on branch `develop` |
| `npm run dev:server` | Minimal API — health only (port 8787) |
| `npm run dev:all` | API + Vite (concurrently) on 5173 |
| `npm run dev:all:uiux` | API + Vite on **5175** |
| `npm run dev:all:develop` | API + Vite on **5176** |
| `npm run build` | Production build to `dist/` |
| `npm run build:e2e` | Production build with `.env.e2e` (mock Entra for Playwright) |
| `npm run preview` | Preview production build |
| `npm run test` | Unit tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright E2E (build + preview) |
| `npm run data` | Regenerate JSON from Excel (edit paths in script if needed) |

## Features (review scope)

1. **Comprehensive Plan** — Cascading selects; **Search Comprehensive Plan** across the full plan text (chapter through sub-level) with level-balanced results; jump the hierarchy without knowing the full path; current selection summary; **Contact Information** (**department required**, primary and alternate contacts); **Legislation details** (legislation title, rich text legislation description, and how the legislation furthers selected policies — each with plain-text length rules). **Save for later** persists the draft (and updates the library row when editing). **Submit** validates and saves to **Your submissions** (no network). **Print document** populates a structured document with the 11 Word-template fields (Date, Department, Legislation Title, Chapter Number/Description, Goal/Description, Policy/Description, Legislation Description, How Furthers) and opens the browser print dialog (Save as PDF from there). No server required.
2. **Your submissions** — Local library with **`CP-######`** record ids; open for edit; duplicate; delete; filter.
3. **Admin Console** (`/admin.html`) — Searchable list of all submissions (name, department, legislation text, contacts, policies, record ID). Click to view full detail; **Edit** contacts, legislation, plan items; **Print document**; **Share link**. Placeholder auth module ready for SSO. Test seed data (48 submissions across 24 departments) loads on first visit. See `src/admin/`.

## Review checklist (stakeholder demo)

- [ ] Use **Search Comprehensive Plan** with a policy number and with a multi-word phrase; confirm results jump the dropdowns correctly.
- [ ] Walk through full hierarchy for one chapter (e.g. Chapter 4) through at least **policy** (sub-policy / sub-level optional for save).
- [ ] Confirm validation when saving with missing action title, short action text, incomplete **primary contact**, or plan not selected through policy.
- [ ] Save at least two library entries, filter, edit one, duplicate one, delete one.
- [ ] Click **Print document** (with form filled); confirm the print preview shows the 11 mapped fields (Date, Department, Legislation Title, Chapter, Goal, Policy, Legislation Description, How Furthers). Save as PDF from the print dialog.
- [ ] Open **Admin Console** from the footer link. Verify the submissions list loads with seed data. Search by department name and by legislation text. Click into a submission; verify all fields display. Toggle **Edit**, change a contact, save. Click **Print document** from the detail page. Click **Share link** and verify clipboard.

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

Current release: **v3.0.0** — see `CHANGELOG.md`.

**Quality checks:** `npm test` (Vitest), `npm run lint`, `npm run build`, `npm run test:e2e` (Playwright against production preview; installs Chromium via Playwright on first run).
