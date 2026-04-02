# Agent / developer — release and build pipeline

Use this checklist for **every** change set that ships. The app version in `package.json` is the source of truth (`src/appVersion.ts` reads it).

## 1. Version

- **Bump `package.json` `version`** whenever you deliver new work (`src/appVersion.ts` reads it).
- **API:** **`GET /api/health`** `version` is read from **`package.json`** in **`server/app.ts`** — no separate manual string. **`server/app.test.ts`** asserts against the same file.
- **Patch-only iterations** (e.g. `1.1.0` → `1.1.1`): only skip a minor/major bump when the product owner explicitly says you are iterating *within* that version; otherwise bump as appropriate for the change.

## 2. Build and test (no known defects)

Run in order; **fix all failures** before release. Do not hand off preview or production builds with failing tests or lint errors.

```bash
npm run build
npm test
npm run lint
npm run test:e2e
```

- Resolve TypeScript, unit test, ESLint, and Playwright issues until the suite is green.
- Reason through edge cases for user-facing changes (validation, storage, export JSON, multi–plan-item flows).

## 3. Documentation after tests pass

- **`CHANGELOG.md`** — add a dated section for the new version (full history).
- **`change.md`** — update the **current release** summary (short, scannable).
- **`agent.md`** — update this file if the release process itself changes.

## 4. GitHub

```bash
git add -A
git commit -m "chore: vX.Y.Z — <short description>"
git push origin master
git tag vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
```

Adjust branch name if your default branch is not `master`.

## 5. Preview in browser

After a successful production build:

```bash
npm run preview
```

Open the URL Vite prints (default **http://localhost:4173**). If the port is busy, Vite chooses the next free port; use that URL instead.

---

**Quick copy-paste (Windows PowerShell, repo root)**

```powershell
npm run build; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm test; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run lint; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
npm run test:e2e; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
```

Then commit, push, tag, push tags, `npm run preview`, and open the preview URL.
