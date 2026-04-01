# CABQ Comprehensive Plan Action Application

Internal application for documenting departmental actions against the Albuquerque / Bernalillo County (ABC) Comprehensive Plan hierarchy (chapter → goal → goal detail → policy → sub-policy → optional sub-level), with **cascading dropdowns** and structured exports.

- **Stack:** React 19, TypeScript, Vite 6, Vitest, ESLint 9
- **Data:** `public/data/comprehensive-plan-hierarchy.json` (generated from `comprehensive plan table.xlsx` via `scripts/excel_to_hierarchy.py`)
- **Storage:** Browser-only (`localStorage`) for drafts and the saved **Library**. No server or SSO in this release.

## Setup

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:5173`).

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run test` | Unit tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run data` | Regenerate JSON from Excel (edit paths in script if needed) |

## Features (review scope)

1. **Composer** — Cascading selects; **Find in plan** search across the full plan text (chapter through sub-level) with level-balanced results; jump the hierarchy without knowing the full path; current selection summary; record title and optional department / reference fields; action narrative.
2. **Library** — Save many records locally; open for edit; duplicate; delete; filter; export all as one JSON file.
3. **Export** — Single-record JSON (Copy / Download) or bundle export from Library. Schema includes `recordTitle`, `department`, `referenceId`, plan nodes, and `actionDetails`.
4. **Print** — Use **Print summary** for a clean printout (toolbar hidden via CSS).

## Review checklist (stakeholder demo)

- [ ] Use **Find in plan** with a policy number and with a multi-word phrase; confirm results jump the dropdowns correctly.
- [ ] Walk through full hierarchy for one chapter (e.g. Chapter 4) through policy and required sub-policy / sub-level rows.
- [ ] Confirm validation messages when saving with missing title or short action text.
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

Current release: **v0.6.0** — see `CHANGELOG.md`.
