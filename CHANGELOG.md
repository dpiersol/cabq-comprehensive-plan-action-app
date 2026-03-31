# Changelog

## [0.4.0] — 2026-03-31

**Review-ready release:** library, validation, exports, tooling.

### Product

- **Library:** Multiple saved action records in the browser; Composer vs Library tabs; edit, duplicate, delete; search filter; **Export all** downloads one JSON bundle (`records[]`).
- **Record metadata:** Title (required to save), optional department/division and internal reference ID; included in all JSON exports.
- **Validation:** Save requires title (≥3 characters), action description (≥10 characters), and a complete hierarchy including sub-policy and sub-level when the plan data requires them. Copy/download JSON validates hierarchy only (no title length rule).
- **UX:** Print-friendly summary (**Print summary**); error boundary; civic styling and responsive layout refinements.

### Engineering

- ESLint 9 (flat config) with TypeScript and React Hooks rules (`npm run lint`).
- GitHub Actions: `npm ci`, lint, test, build on push/PR to `master`.
- `buildActionRecordFromSnapshot()` centralizes export shape.

## [0.2.0] — 2026-03-31

- Local draft auto-save and JSON copy/download.

## [0.1.0] — 2026-03-31

- Initial prototype: cascading plan hierarchy and action details.
