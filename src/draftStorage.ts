import type { PlanData } from "./types";

export const DRAFT_STORAGE_KEY = "cabq-comp-plan-action-draft-v1";

export interface DraftSnapshot {
  chapterIdx: number;
  goalIdx: number;
  goalDetailIdx: number;
  policyIdx: number;
  subPolicyIdx: number;
  subLevelIdx: number;
  actionDetails: string;
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
  };
}

function readIdx(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return -1;
  return Math.trunc(v);
}

function readStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Parse JSON from localStorage; invalid shapes yield null fields handled by normalize. */
export function parseDraftJson(raw: unknown): DraftSnapshot {
  if (!raw || typeof raw !== "object") return emptyDraft();
  const o = raw as Record<string, unknown>;
  return {
    chapterIdx: readIdx(o.chapterIdx),
    goalIdx: readIdx(o.goalIdx),
    goalDetailIdx: readIdx(o.goalDetailIdx),
    policyIdx: readIdx(o.policyIdx),
    subPolicyIdx: readIdx(o.subPolicyIdx),
    subLevelIdx: readIdx(o.subLevelIdx),
    actionDetails: readStr(o.actionDetails),
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
  const actionDetails = raw.actionDetails;
  const chapters = plan.chapters;
  if (raw.chapterIdx < 0 || raw.chapterIdx >= chapters.length) {
    return { ...emptyDraft(), actionDetails };
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
      actionDetails,
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
      actionDetails,
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
      actionDetails,
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
      actionDetails,
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
      actionDetails,
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
      actionDetails,
    };
  }

  return {
    chapterIdx,
    goalIdx,
    goalDetailIdx,
    policyIdx,
    subPolicyIdx,
    subLevelIdx: raw.subLevelIdx,
    actionDetails,
  };
}
