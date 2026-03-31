# CABQ Comprehensive Plan Action Application

Internal prototype for documenting departmental actions against the Albuquerque / Bernalillo County (ABC) Comprehensive Plan hierarchy (chapter → goal → goal detail → policy → sub-policy → optional sub-level), with cascading dropdowns and a free-text action description.

- **Stack:** React 19, TypeScript, Vite 6
- **Data:** `public/data/comprehensive-plan-hierarchy.json` (generated from `comprehensive plan table.xlsx` via `scripts/excel_to_hierarchy.py`)
- **Auth / SSO:** Not included in this prototype (planned later)
- **Draft:** Form state is auto-saved in the browser (`localStorage`). Use **Copy JSON** or **Download JSON** to export a structured record for workflows outside the app.

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
| `npm run data` | Regenerate JSON from Excel (edit paths in script if needed) |

## Regenerating data

Point `scripts/excel_to_hierarchy.py` at your Excel export, then:

```bash
python scripts/excel_to_hierarchy.py
```

## References

- [ABC Comprehensive Plan — City of Albuquerque](https://www.cabq.gov/planning/plans-publications/abc-comprehensive-plan)
- [Interactive Comprehensive Plan](https://compplan.abq-zone.com/)

## Version

Current release: **v0.2.0** (local draft + JSON export).
