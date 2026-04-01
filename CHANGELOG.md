# Changelog

## [0.7.0] — 2026-03-31

### Product

- **Action details:** **Action title** moved here (was “Record title” in Record). **Describe the departmental action** capped at **500 characters** with a live counter. **Attachments:** multiple uploads with allowlisted business document and image types, size limits, and blocks on executables, scripts, and risky extensions (see `attachmentPolicy.ts`).
- **Contact Information** (section renamed from Record): **Department** field (was “Department / division”). **Primary** and **Alternate** contact blocks (name, role, email, phone). Removed **Internal reference #**.

### Engineering

- Draft snapshot and JSON export include `actionTitle`, `primaryContact`, `alternateContact`, `attachments`; legacy `title` in stored drafts migrates to `actionTitle`.

## [0.6.2] — 2026-04-01

- Section title **Comprehensive Plan Items** (replaces abbreviated “Compl Plan Items”).
- Chapter placeholder text **Select chapter...** (ASCII ellipsis).
- **Default hierarchy:** On load, the composer always starts with **Select chapter...** (no chapter pre-selected). Browser draft still restores record title, department, reference #, and action details only; library **Edit** still loads full hierarchy from a saved record.

## [0.6.1] — 2026-04-01

- UI copy: section title **Compl Plan Items** (was “Plan hierarchy”); search label **Search Comprehensive Plan** (was “Find in plan”).

## [0.6.0] — 2026-04-01

- **Plan search:** Every index row’s `searchBlob` now concatenates **chapter → goal → goal detail → policy → sub-policy → sub-level** text with null-safe field normalization (`searchText.ts`), so every level is explicitly indexed—not only leaf text.
- **Ranking:** Replaced “specificity bonus” (which buried chapter/goal/policy hits under sub-level rows sharing the same ancestor text) with **round-robin interleaving** by level: one best match per level per round, iterating chapter → goal → goal detail → policy → sub-policy → sub-level. Within each level, earlier token matches in the blob still rank higher.
- **Tests:** `searchText`, `buildPlanSearchIndex` ancestor-chain coverage, `searchPlan` diversity + `tokenScore` unit tests.

## [0.5.1] — 2026-03-31

- **Fix:** Sub-policy sub-level rows in the plan JSON may contain `roman: null` (Excel export). `subLevelLabel` no longer calls `.trim()` on null; `SubLevel` types allow null fields. Resolves runtime error: “Cannot read properties of null (reading 'trim')”.

## [0.5.0] — 2026-03-31

- **Plan hierarchy search:** Full-text style search across chapters, goals, goal details, policies, sub-policies, and sub-levels. Multi-word queries use AND matching (all words must appear). Results are ranked by match position and specificity; choosing a result jumps all cascaded dropdowns to that node without changing record metadata or action text.
- **Tests:** `buildPlanSearchIndex`, `searchPlan`, and integration coverage.

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
