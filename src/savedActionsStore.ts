/**
 * Browser localStorage persistence for **admin.html** and legacy/dev use.
 * The main SPA (`/app`, `/app/compose`) persists submissions via `/api/submissions` instead.
 */
import type { DraftSnapshot } from "./draftStorage";
import { cloneDraftSnapshot, emptyDraft, parseDraftJson } from "./draftStorage";

export const SAVED_ACTIONS_KEY = "cabq-comp-plan-saved-actions-v1";

export interface SavedAction {
  id: string;
  /** Human-readable id for lists and PDF filenames, e.g. CP-000001. */
  cpRecordId: string;
  createdAt: string;
  updatedAt: string;
  snapshot: DraftSnapshot;
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function maxCpNumber(list: SavedAction[]): number {
  let max = 0;
  for (const a of list) {
    const m = /^CP-(\d+)$/.exec(a.cpRecordId);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

function nextCpRecordId(list: SavedAction[]): string {
  const n = maxCpNumber(list) + 1;
  return `CP-${String(n).padStart(6, "0")}`;
}

function parseSavedList(raw: unknown): SavedAction[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedAction[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.createdAt !== "string" || typeof o.updatedAt !== "string")
      continue;
    const snap = parseDraftJson(o.snapshot);
    const cpRecordId = typeof o.cpRecordId === "string" ? o.cpRecordId : "";
    out.push({ id: o.id, cpRecordId, createdAt: o.createdAt, updatedAt: o.updatedAt, snapshot: snap });
  }
  return out;
}

function assignMissingCpRecordIds(list: SavedAction[]): { list: SavedAction[]; changed: boolean } {
  const missing = list.filter((a) => !a.cpRecordId);
  if (missing.length === 0) return { list, changed: false };
  let n = maxCpNumber(list);
  const sorted = [...missing].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const map = new Map<string, string>();
  for (const a of sorted) {
    n += 1;
    map.set(a.id, `CP-${String(n).padStart(6, "0")}`);
  }
  return {
    list: list.map((a) => (a.cpRecordId ? a : { ...a, cpRecordId: map.get(a.id)! })),
    changed: true,
  };
}

export function loadSavedActions(): SavedAction[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const s = localStorage.getItem(SAVED_ACTIONS_KEY);
    if (!s) return [];
    let list = parseSavedList(JSON.parse(s) as unknown);
    const migrated = assignMissingCpRecordIds(list);
    if (migrated.changed) {
      persist(migrated.list);
      list = migrated.list;
    }
    return list;
  } catch {
    return [];
  }
}

function persist(list: SavedAction[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SAVED_ACTIONS_KEY, JSON.stringify(list));
  } catch {
    /* quota */
  }
}

export function saveNewAction(snapshot: DraftSnapshot): SavedAction {
  const now = new Date().toISOString();
  const list = loadSavedActions();
  const cpRecordId = nextCpRecordId(list);
  const action: SavedAction = {
    id: newId(),
    cpRecordId,
    createdAt: now,
    updatedAt: now,
    snapshot: { ...snapshot },
  };
  list.unshift(action);
  persist(list);
  return action;
}

export function updateAction(id: string, snapshot: DraftSnapshot): SavedAction | null {
  const list = loadSavedActions();
  const i = list.findIndex((a) => a.id === id);
  if (i < 0) return null;
  const now = new Date().toISOString();
  list[i] = {
    ...list[i],
    snapshot: cloneDraftSnapshot(snapshot),
    updatedAt: now,
  };
  persist(list);
  return list[i];
}

export function deleteAction(id: string): void {
  const list = loadSavedActions().filter((a) => a.id !== id);
  persist(list);
}

export function getAction(id: string): SavedAction | null {
  return loadSavedActions().find((a) => a.id === id) ?? null;
}

/** Snapshot for duplicating into the form (suffix action title). */
export function duplicateSnapshot(snap: DraftSnapshot): DraftSnapshot {
  const base = cloneDraftSnapshot(snap);
  const t = base.actionTitle.trim();
  return {
    ...base,
    actionTitle: t ? `${t} (copy)` : "",
  };
}

export function emptySavedSnapshot(): DraftSnapshot {
  return emptyDraft();
}
