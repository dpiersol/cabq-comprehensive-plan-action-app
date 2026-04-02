# Agent and collaborator conventions

This file applies whether you work **solo**, on a **team**, or with **multiple AI agents** on one repository. It is the durable counterpart to chat: **the repo wins when something disagrees with a conversation.**

## About this repository

- **CABQ Comprehensive Plan Action Application** — internal React + TypeScript + Vite app for documenting departmental actions against the ABC Comprehensive Plan hierarchy, with cascading selects, library, export, and print. See [`README.md`](README.md).
- **Stack:** React 19, TypeScript, Vite 8, Vitest, ESLint 9; optional **minimal Fastify** API (`GET /api/health` only). Vite dev proxies `/api` when the API runs (`npm run dev:all` or `dev:server`).
- **Data:** `public/data/comprehensive-plan-hierarchy.json` — regenerate from Excel via `scripts/excel_to_hierarchy.py` (`npm run data`).
- **Shelved workflow:** The older Fastify + SQLite workflow lives under **`archive/workflow-shelved/`** and is restorable from tag **`v0.9.0`**. Do not assume workflow paths in `archive/` are part of the default dev loop unless you are explicitly restoring that stack.
- **Exports:** v0.11+ uses **`compPlanItems`** (array); legacy single-hierarchy root fields were removed—treat export changes as **breaking** for downstream consumers.

## Read order

1. This file (`agents.md`)
2. `current_task.md`
3. [`README.md`](README.md), [`CHANGELOG.md`](CHANGELOG.md) for version and breaking changes

## Source of truth

- **Git history and committed files** are authoritative—not chat transcripts.
- Prefer **commit messages** and **CHANGELOG** entries for durable intent; run **`npm test`**, **`npm run lint`**, **`npm run build`**, and E2E as appropriate before merging substantive UI changes.

## Branches and integration

- Default branch is **`master`** (as of repo setup). Prefer **one logical task per branch** (`feature/…`, `fix/…`).
- **Pull latest** before starting substantive work; **integrate often**.

## `current_task.md`

- Keep it **short and current**; list **components or files** you are actively changing so agents or teammates avoid overlapping edits.

## Solo dev

- Use `current_task.md` when switching machines or after a break so “what was I doing?” is obvious.

## Team

- Coordinate **ownership** via issues/assignees and `current_task.md`.

## Multiple agents (or agent + human) on one repo

- Split by **feature area** (e.g. composer vs library vs export) or **branch**; the **composer** and **export JSON schema** are high-conflict areas—coordinate there first.

## Optional local overrides

- Use a **gitignored** `current_task.local.md` for private notes; keep `current_task.md` shareable.
