import type { PlanData } from "./types";
import type { ContactBlock } from "./contacts";
import { emptyContact } from "./contacts";

export const DRAFT_STORAGE_KEY = "cabq-comp-plan-action-draft-v1";

/** One path through the comprehensive plan hierarchy (indices into loaded JSON). */
export interface PlanItemSelection {
  chapterIdx: number;
  goalIdx: number;
  goalDetailIdx: number;
  policyIdx: number;
  subPolicyIdx: number;
  subLevelIdx: number;
}

export interface DraftSnapshot {
  /** One or more plan paths this action applies to. */
  planItems: PlanItemSelection[];
  actionDetails: string;
  actionTitle: string;
  /** Plain text: how this legislation furthers selected policies (max 1000 in UI). */
  howFurthersPolicies: string;
  department: string;
  primaryContact: ContactBlock;
  alternateContact: ContactBlock;
}

export function emptyPlanItem(): PlanItemSelection {
  return {
    chapterIdx: -1,
    goalIdx: -1,
    goalDetailIdx: -1,
    policyIdx: -1,
    subPolicyIdx: -1,
    subLevelIdx: -1,
  };
}

function packMeta(
  raw: DraftSnapshot,
): Pick<
  DraftSnapshot,
  | "actionDetails"
  | "actionTitle"
  | "howFurthersPolicies"
  | "department"
  | "primaryContact"
  | "alternateContact"
  | "planItems"
> {
  const items = Array.isArray(raw.planItems) ? raw.planItems : [];
  return {
    actionDetails: raw.actionDetails,
    actionTitle: raw.actionTitle ?? "",
    howFurthersPolicies: typeof raw.howFurthersPolicies === "string" ? raw.howFurthersPolicies : "",
    department: raw.department ?? "",
    primaryContact: raw.primaryContact ?? emptyContact(),
    alternateContact: raw.alternateContact ?? emptyContact(),
    planItems: items.length > 0 ? items.map((p) => ({ ...p })) : [emptyPlanItem()],
  };
}

export function emptyDraft(): DraftSnapshot {
  return {
    planItems: [emptyPlanItem()],
    actionDetails: "",
    actionTitle: "",
    howFurthersPolicies: "",
    department: "",
    primaryContact: emptyContact(),
    alternateContact: emptyContact(),
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

function parsePlanItem(o: Record<string, unknown>): PlanItemSelection {
  return {
    chapterIdx: readIdx(o.chapterIdx),
    goalIdx: readIdx(o.goalIdx),
    goalDetailIdx: readIdx(o.goalDetailIdx),
    policyIdx: readIdx(o.policyIdx),
    subPolicyIdx: readIdx(o.subPolicyIdx),
    subLevelIdx: readIdx(o.subLevelIdx),
  };
}

/** Parse JSON from localStorage; migrates legacy flat indices → `planItems[0]`. Ignores legacy `attachments`. */
export function parseDraftJson(raw: unknown): DraftSnapshot {
  if (!raw || typeof raw !== "object") return emptyDraft();
  const o = raw as Record<string, unknown>;
  const legacyTitle = readStr(o.title);
  const actionTitle = readStr(o.actionTitle) || legacyTitle;

  let planItems: PlanItemSelection[];
  const pi = o.planItems;
  if (Array.isArray(pi) && pi.length > 0) {
    planItems = pi
      .filter((x): x is Record<string, unknown> => x !== null && typeof x === "object")
      .map((x) => parsePlanItem(x));
    if (planItems.length === 0) planItems = [emptyPlanItem()];
  } else {
    planItems = [
      {
        chapterIdx: readIdx(o.chapterIdx),
        goalIdx: readIdx(o.goalIdx),
        goalDetailIdx: readIdx(o.goalDetailIdx),
        policyIdx: readIdx(o.policyIdx),
        subPolicyIdx: readIdx(o.subPolicyIdx),
        subLevelIdx: readIdx(o.subLevelIdx),
      },
    ];
  }

  return {
    planItems,
    actionDetails: readStr(o.actionDetails),
    actionTitle,
    howFurthersPolicies: readStr(o.howFurthersPolicies),
    department: readStr(o.department),
    primaryContact: parseContact(o.primaryContact),
    alternateContact: parseContact(o.alternateContact),
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
 * Clamp one plan item to a valid path in the loaded plan.
 */
export function normalizePlanItem(plan: PlanData, raw: PlanItemSelection): PlanItemSelection {
  const chapters = plan.chapters;
  if (raw.chapterIdx < 0 || raw.chapterIdx >= chapters.length) {
    return emptyPlanItem();
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
    };
  }

  return {
    chapterIdx,
    goalIdx,
    goalDetailIdx,
    policyIdx,
    subPolicyIdx,
    subLevelIdx: raw.subLevelIdx,
  };
}

/**
 * Clamp all plan items to valid paths; ensures at least one row exists.
 */
export function normalizeDraft(plan: PlanData, raw: DraftSnapshot): DraftSnapshot {
  const meta = packMeta(raw);
  const items = meta.planItems.map((it) => normalizePlanItem(plan, it));
  return {
    ...meta,
    planItems: items.length > 0 ? items : [emptyPlanItem()],
  };
}

/** Deep-clone snapshot for library persistence (avoids shared `planItems` row refs). */
export function cloneDraftSnapshot(s: DraftSnapshot): DraftSnapshot {
  return {
    ...s,
    planItems: s.planItems.map((p) => ({ ...p })),
    primaryContact: { ...s.primaryContact },
    alternateContact: { ...s.alternateContact },
  };
}
