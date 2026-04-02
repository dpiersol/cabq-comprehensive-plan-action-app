# Current task

> Update this file when the active task or ownership changes. Keep it short.

## Active branch

`master`

## Owner

Unassigned

## Goal

Ship and maintain the static comprehensive-plan action app; keep exports and library data model consistent with [`CHANGELOG.md`](CHANGELOG.md).

## In scope

- App source, `public/data/`, minimal API under `server/`, tests, Playwright E2E.
- Regenerating hierarchy JSON from Excel when the plan table changes (`npm run data`).

## Out of scope / do not touch

- **`archive/workflow-shelved/`** unless restoring or documenting the shelved workflow (see README + tag `v0.9.0`).

## Links

- Issue: <!-- URL or #123 -->
- PR: <!-- URL or #456 -->

## Recent activity (from Git)

- **v0.11.0:** Multiple comprehensive plan items per action (`planItems` / `compPlanItems`); composer stacked rows; **breaking** export shape change from single root hierarchy fields.
- Prior: **v0.10.0** shelved full workflow to `archive/`; live API is health-only.

## Next (optional)

- Stakeholder **review checklist** in [`README.md`](README.md) when preparing for demo.
- If editing docs, align “Current release” line in README with `package.json` / CHANGELOG when you bump versions.

## Last updated

2026-04-02
