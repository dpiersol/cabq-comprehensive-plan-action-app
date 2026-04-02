# Changelog

## [0.11.4] — 2026-04-02

- **Department** is **required** for save and export: validation error **Enter a department.** if blank; combobox shows **(required)** and updated placeholder.
- **API:** `GET /api/health` `version` **0.11.4**.

## [0.11.3] — 2026-04-02

- **Labels:** **Action title** → **Legislation title**; **Action description** → **Legislation description**; section heading **Legislation details**.
- **New field:** **How does this legislation further policies selected?** — required plain-text area, **10–1000** characters (stored as `howFurthersPolicies`, included in JSON export).
- **Validation messages** updated to use “legislation” wording where applicable. **Library** table column **Legislation title**.

## [0.11.2] — 2026-04-02

- **Composer:** Choosing a **Goal** automatically selects the first **Goal detail** for that goal (users can still change goal detail afterward).
- **Action description:** Plain-text maximum increased to **2500** characters; the live character counter was removed (validation unchanged otherwise).
- **Attachments removed** from the UI, draft snapshot, library records, and export JSON (`attachments` field removed from export payload). Legacy drafts with stored attachments ignore attachment data on load.
- **API:** `GET /api/health` `version` updated to **0.11.2** (keep in sync with `package.json` when releasing).

## [0.11.1] — 2026-04-02

- **Docs / process:** Added **`agent.md`** (release and build checklist: version bump, `npm run build` / `test` / `lint` / `test:e2e`, update **`CHANGELOG.md`** and **`change.md`**, push to GitHub including **`v0.11.1`** tag, open **`npm run preview`** in the browser). Added **`change.md`** as a short “current release” summary; full history stays here.

## [0.11.0] — 2026-03-31

- **Multiple comprehensive plan items:** The composer supports **one or more** hierarchy rows per action. Use **Add another plan item** to append a row; **Remove** appears when there is more than one row. Hierarchy search applies to the row you last focused (highlighted). Saved draft JSON and library entries store `planItems` (legacy flat `chapterIdx` / … fields in stored JSON are migrated to `planItems[0]` on load).
- **Export JSON (breaking):** Root `chapter` / `goal` / `policy` / … fields are replaced by **`compPlanItems`**, an array of hierarchy objects in composer order. Downstream consumers should read `compPlanItems` (and handle length ≥ 1).

## [0.10.0] — 2026-04-01

- **Workflow feature shelved (not deleted):** The full workflow stack is **copied to `archive/workflow-shelved/`** with restore instructions. The live app drops the **Workflow** tab, **Submit to workflow**, and **`#/fi/...`** department view. The running API is **minimal** (`GET /api/health` with `{ workflow: "shelved" }`) so `dev:server` / Vite `/api` proxy still work.
- **Removed** from the active tree: Drizzle/SQLite workflow server, demo seed script, `drizzle.config.ts`, `scripts/gen-workflow-plan.mjs` (archived copy kept). **Dependencies** trimmed (no `better-sqlite3`, `drizzle-orm`, `docx`, `uuid`, `zod` in the default install).
- **E2E:** Smoke test no longer opens the Workflow tab.

Restore workflow from Git tag **`v0.9.0`** or from `archive/workflow-shelved/` — see `archive/workflow-shelved/README.md`.

## [0.9.0] — 2026-04-01

**First iteration complete** — milestone release: composer (rich action description, validation), local library, workflow API (SQLite), staff inboxes, FI department link, Word placeholder export, Playwright E2E, demo workflow seed, and toolchain upgrades (Vite 8, Vitest 4, TypeScript 6, React 19.2, TipTap).

- Bumps app and API health version to **0.9.0**.
- **`WORKFLOW_DEMO_SEED` on startup** is skipped when Vitest or `NODE_ENV=test` runs the API, so unit tests stay fast and reliable.

## [0.8.6] — 2026-04-01

- **Demo workflow seed:** `npm run seed:demo` inserts **30** submissions — **5** per workflow position: Planning review, Planning (after council review), City Council review, Further information (requested by Planning), Further information (requested by Council), and Complete. Rows use ids prefixed with `demo-` (re-seeding clears previous demo rows). Optional: start the API with `WORKFLOW_DEMO_SEED=1` to seed on startup.
- API **GET /api/health** `version` field updated to **0.8.6**.

## [0.8.5] — 2026-04-01

### Stage A — Toolchain (latest stable where compatible)

- **Vite 8**, **Vitest 4**, **TypeScript 6**, **React 19.2**, **@vitejs/plugin-react 6**, **@fastify/cors 11**, **typescript-eslint 8.58**, **globals 17**, **ESLint 9.39** + **eslint-plugin-react-hooks 7**. (ESLint 10 is not used yet: `eslint-plugin-react-hooks` still peers ESLint `^9` only.)
- Removed **`@types/uuid`** (uuid ships its own types; the `@types` package is deprecated).
- **Department combobox:** reset highlight without `setState` inside `useEffect` (satisfies new `react-hooks/set-state-in-effect` rule).

### Stage B — Browser verification

- **Playwright** (Chromium) end-to-end tests: `npm run test:e2e` runs **`npm run build`** then **`vite preview`** and exercises shell, tabs, hierarchy + save to library, department combobox, and TipTap bold. Use `npm run test:e2e:ui` for the Playwright UI runner.
- Preview URL for manual checks: after `npm run build`, run `npm run preview` and open the URL shown (default **http://localhost:4173**).

## [0.8.3] — 2026-03-31

- **Fix (React 19):** Replaced **react-quill** with **TipTap** for the action description editor. `react-quill` relied on `ReactDOM.findDOMNode`, which was removed in React 19 and caused *“Something went wrong”* / `findDOMNode is not a function` at runtime. Behavior is unchanged: HTML storage, plain-text validation, toolbar (headings, bold/italic/underline, lists, links, clear).

## [0.8.2] — 2026-03-31

- **Action title** and **Action description** (renamed from “Describe the departmental action”) are **required** for save, JSON export, and workflow submit. Validation uses **plain-text length** after stripping rich text markup (max **500** characters of plain text).
- **Action description** is a **rich text** field (Quill toolbar: headings, bold/italic/underline, lists, links). Character counts and limits apply to plain text, not raw HTML.
- Word export (Complete) writes plain text for the description column.

## [0.8.1] — 2026-04-01

- **Department** field uses the City of Albuquerque department list (sorted A–Z) with a **combobox**: type to filter, click **▾** or focus to open the full list, keyboard arrows + Enter. Custom text is still allowed if there is no match.

## [0.8.0] — 2026-04-01

### Product

- **Workflow API (Fastify + SQLite):** Submit validated forms to a server-side repository (`POST /api/submissions`). **Workflow** tab: mock staff login (seed users), inbox by role (Planning sees all; City Council sees council queue), transitions, comments for FI / Council→Planning, department FI link (`#/fi/:token`), rough **Word** download on Complete.
- **Notifications:** Rows stored in DB + console `[NOTIFICATION]` log (SMTP later).

### Engineering

- `server/` — Drizzle ORM, `workflow/engine.ts` state machine, `data/workflow.db` (override with `WORKFLOW_DB_PATH`). **`workflow_plan.docx`** generated via `node scripts/gen-workflow-plan.mjs`.
- **Dev:** `npm run dev:server` (port 8787), `npm run dev:all` (API + Vite); Vite proxies `/api` to the API.

## [0.7.1] — 2026-03-31

- **Save / export validation:** **Primary contact** (name, role, email, phone) is required: valid-looking email and at least **7 digits** in the phone field. **Plan selection** must reach **policy** (chapter → goal → goal detail → policy). Sub-policy and sub-policy sub-level are **optional** for save and JSON export.
- UI: primary contact labels show **(required)** and `aria-required` for accessibility.

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
