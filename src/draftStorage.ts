import type { PlanData } from "./types";
import type { ContactBlock } from "./contacts";
import { emptyContact } from "./contacts";

export const DRAFT_STORAGE_KEY = "cabq-comp-plan-action-draft-v1";

export interface StoredAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  /** Raw base64 only (no data: URL prefix). */
  dataBase64: string;
}

export interface DraftSnapshot {
  chapterIdx: number;
  goalIdx: number;
  goalDetailIdx: number;
  policyIdx: number;
  subPolicyIdx: number;
  subLevelIdx: number;
  actionDetails: string;
  actionTitle: string;
  department: string;
  primaryContact: ContactBlock;
  alternateContact: ContactBlock;
  attachments: StoredAttachment[];
}

function packMeta(raw: DraftSnapshot): Pick<
  DraftSnapshot,
  | "actionDetails"
  | "actionTitle"
  | "department"
  | "primaryContact"
  | "alternateContact"
  | "attachments"
> {
  return {
    actionDetails: raw.actionDetails,
    actionTitle: raw.actionTitle ?? "",
    department: raw.department ?? "",
    primaryContact: raw.primaryContact ?? emptyContact(),
    alternateContact: raw.alternateContact ?? emptyContact(),
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
  };
}

export function emptyDraft(): DraftSnapshot {
  return {
    chapterIdx: -1,
    goalIdx: -1,
    goalDetailIdx: -1,
    policyIdx: -1,
    subPolicyIdx: -1,
    subLevelIdx: -1,
    actionDetails: "",
    actionTitle: "",
    department: "",
    primaryContact: emptyContact(),
    alternateContact: emptyContact(),
    attachments: [],
  };
}

function readIdx(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return -1;
  return Math.trunc(v);
}

function readStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function parseContact(raw: unknown): ContactBlock {
  if (!raw || typeof raw !== "object") return emptyContact();
  const o = raw as Record<string, unknown>;
  return {
    name: readStr(o.name),
    role: readStr(o.role),
    email: readStr(o.email),
    phone: readStr(o.phone),
  };
}

function parseAttachments(raw: unknown): StoredAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (
      typeof o.id !== "string" ||
      typeof o.fileName !== "string" ||
      typeof o.mimeType !== "string" ||
      typeof o.size !== "number" ||
      typeof o.dataBase64 !== "string"
    ) {
      continue;
    }
    out.push({
      id: o.id,
      fileName: o.fileName,
      mimeType: o.mimeType,
      size: o.size,
      dataBase64: o.dataBase64,
    });
  }
  return out;
}

/** Parse JSON from localStorage; migrates legacy `title` → `actionTitle`. */
export function parseDraftJson(raw: unknown): DraftSnapshot {
  if (!raw || typeof raw !== "object") return emptyDraft();
  const o = raw as Record<string, unknown>;
  const legacyTitle = readStr(o.title);
  const actionTitle = readStr(o.actionTitle) || legacyTitle;

  return {
    chapterIdx: readIdx(o.chapterIdx),
    goalIdx: readIdx(o.goalIdx),
    goalDetailIdx: readIdx(o.goalDetailIdx),
    policyIdx: readIdx(o.policyIdx),
    subPolicyIdx: readIdx(o.subPolicyIdx),
    subLevelIdx: readIdx(o.subLevelIdx),
    actionDetails: readStr(o.actionDetails),
    actionTitle,
    department: readStr(o.department),
    primaryContact: parseContact(o.primaryContact),
    alternateContact: parseContact(o.alternateContact),
    attachments: parseAttachments(o.attachments),
  };
}

export function loadDraftFromStorage(): DraftSnapshot | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const s = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!s) return null;
    return parseDraftJson(JSON.parse(s) as unknown);
  } catch {
    return null;
  }
}

export function saveDraftToStorage(d: DraftSnapshot): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(d));
  } catch {
    /* quota or private mode */
  }
}

export function clearDraftStorage(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Clamp indices to valid paths in the loaded plan so a stale draft does not break the UI.
 */
export function normalizeDraft(plan: PlanData, raw: DraftSnapshot): DraftSnapshot {
  const meta = packMeta(raw);
  const chapters = plan.chapters;
  if (raw.chapterIdx < 0 || raw.chapterIdx >= chapters.length) {
    return { ...emptyDraft(), ...meta };
  }

  const chapterIdx = raw.chapterIdx;
  const goals = chapters[chapterIdx].goals;
  if (raw.goalIdx < 0 || raw.goalIdx >= goals.length) {
    return {
      chapterIdx,
      goalIdx: -1,
      goalDetailIdx: -1,
      policyIdx: -1,
      subPolicyIdx: -1,
      subLevelIdx: -1,
      ...meta,
    };
  }

  const goalIdx = raw.goalIdx;
  const goalDetails = goals[goalIdx].goalDetails;
  if (raw.goalDetailIdx < 0 || raw.goalDetailIdx >= goalDetails.length) {
    return {
      chapterIdx,
      goalIdx,
      goalDetailIdx: -1,
      policyIdx: -1,
      subPolicyIdx: -1,
      subLevelIdx: -1,
      ...meta,
    };
  }

  const goalDetailIdx = raw.goalDetailIdx;
  const policies = goalDetails[goalDetailIdx].policies;
  if (raw.policyIdx < 0 || raw.policyIdx >= policies.length) {
    return {
      chapterIdx,
      goalIdx,
      goalDetailIdx,
      policyIdx: -1,
      subPolicyIdx: -1,
      subLevelIdx: -1,
      ...meta,
    };
  }

  const policyIdx = raw.policyIdx;
  const subPolicies = policies[policyIdx].subPolicies;
  if (raw.subPolicyIdx < 0 || raw.subPolicyIdx >= subPolicies.length) {
    return {
      chapterIdx,
      goalIdx,
      goalDetailIdx,
      policyIdx,
      subPolicyIdx: -1,
      subLevelIdx: -1,
      ...meta,
    };
  }

  const subPolicyIdx = raw.subPolicyIdx;
  const subLevels = subPolicies[subPolicyIdx].subLevels ?? [];
  if (subLevels.length === 0) {
    return {
      chapterIdx,
      goalIdx,
      goalDetailIdx,
      policyIdx,
      subPolicyIdx,
      subLevelIdx: -1,
      ...meta,
    };
  }

  if (raw.subLevelIdx < 0 || raw.subLevelIdx >= subLevels.length) {
    return {
      chapterIdx,
      goalIdx,
      goalDetailIdx,
      policyIdx,
      subPolicyIdx,
      subLevelIdx: -1,
      ...meta,
    };
  }

  return {
    chapterIdx,
    goalIdx,
    goalDetailIdx,
    policyIdx,
    subPolicyIdx,
    subLevelIdx: raw.subLevelIdx,
    ...meta,
  };
}
