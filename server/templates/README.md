# Comprehensive Plan print template (Word)

PDF generation loads this **`.docx`**, merges submission data with [docxtemplater](https://docxtemplater.com/), then converts to PDF with **LibreOffice** (headless). Template resolution (first match):

1. **`COMP_PLAN_DOCX_TEMPLATE`** — absolute path to a `.docx`.
2. **`server/templates/comp-plan-print-template.docx`** — bundled / repo copy.
3. **Desktop** — `comp plan print template.docx` on your user profile Desktop.

## Placeholders

The city template uses Word-style names; the server **renames** them internally to camelCase and fixes a few placeholders Word split across runs.

| In the Word file (before merge) | Data |
|----------------------------------|------|
| `{Current Date}` | Long-form current date |
| `{Legislation Title}` | Legislation title |
| `{Chapter Number}` and `{Chapter Description}` | Split from the app’s combined chapter line (e.g. `1 — Title` → `1` + `Title`) |
| `{Goal}` and `{Goal Description}` | Split from the combined goal line |
| `{Policy}` and `{Policy Description}` | Split from the combined policy line (supports ` — `, ` – `, or ` - `) |
| `{Legislation Description}` (may be split across runs in Word) | Plain-text legislation description |
| `{How does this legislation further the policies selected?}` (may be split across runs) | Furtherance text |

## LibreOffice

- **Windows:** Install [LibreOffice](https://www.libreoffice.org/) so conversion can run (see `PATH` / `soffice`).
- **Vitest:** Uses a small PDFKit fallback (no template/LibreOffice).
- **Force fallback:** `COMP_PLAN_PDF_SIMPLE=1` skips Word + LibreOffice.
