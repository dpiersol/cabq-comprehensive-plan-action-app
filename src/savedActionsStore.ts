import type { DraftSnapshot } from "./draftStorage";
import { emptyDraft, parseDraftJson } from "./draftStorage";

export const SAVED_ACTIONS_KEY = "cabq-comp-plan-saved-actions-v1";

export interface SavedAction {
  id: string;
  createdAt: string;
  updatedAt: string;
  snapshot: DraftSnapshot;
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
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
    out.push({ id: o.id, createdAt: o.createdAt, updatedAt: o.updatedAt, snapshot: snap });
  }
  return out;
}

export function loadSavedActions(): SavedAction[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const s = localStorage.getItem(SAVED_ACTIONS_KEY);
    if (!s) return [];
    return parseSavedList(JSON.parse(s) as unknown);
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
  const action: SavedAction = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    snapshot: { ...snapshot },
  };
  const list = loadSavedActions();
  list.unshift(action);
  persist(list);
  return action;
}

export function updateAction(id: string, snapshot: DraftSnapshot): SavedAction | null {
  const list = loadSavedActions();
  const i = list.findIndex((a) => a.id === id);
  if (i < 0) return null;
  const now = new Date().toISOString();
  list[i] = { ...list[i], snapshot: { ...snapshot }, updatedAt: now };
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

/** Snapshot for duplicating into the composer (suffix action title). */
export function duplicateSnapshot(snap: DraftSnapshot): DraftSnapshot {
  const base = { ...snap };
  const t = base.actionTitle.trim();
  return {
    ...base,
    actionTitle: t ? `${t} (copy)` : "",
  };
}

export function emptySavedSnapshot(): DraftSnapshot {
  return emptyDraft();
}
