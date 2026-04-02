import type { Chapter, Goal, GoalDetail, PlanData, Policy, SubLevel, SubPolicy } from "./types";
import type { DraftSnapshot } from "./draftStorage";
import type { ContactBlock } from "./contacts";
import { resolvePlanItem } from "./planSelection";
import type { ResolvedSelection } from "./planSelection";

/** One row in the comprehensive plan hierarchy (export JSON). */
export interface CompPlanItemRecord {
  chapter: { number: number; title: string } | null;
  goal: { number: string; description: string } | null;
  goalDetail: string | null;
  policy: { number: string; description: string } | null;
  subPolicy: {
    letter?: string;
    description?: string;
    text?: string;
  } | null;
  subLevel: { roman: string | null; description: string | null } | null;
}

export interface ActionRecordPayload {
  appVersion: string;
  exportedAt: string;
  actionTitle: string;
  department: string;
  primaryContact: ContactBlock;
  alternateContact: ContactBlock;
  /** All plan paths this action documents (order matches the composer). */
  compPlanItems: CompPlanItemRecord[];
  actionDetails: string;
  /** Plain text: how this legislation furthers selected policies. */
  howFurthersPolicies: string;
}

function compPlanItemFromResolved(sel: ResolvedSelection): CompPlanItemRecord {
  const c = sel.chapter;
  const g = sel.goal;
  const gd = sel.goalDetail;
  const p = sel.policy;
  const sp = sel.subPolicy;
  const sl = sel.subLevel;

  return {
    chapter: c ? { number: c.chapterNumber, title: c.chapterTitle } : null,
    goal: g ? { number: g.goalNumber, description: g.goalDescription } : null,
    goalDetail: gd?.detail?.trim() ? gd.detail : null,
    policy: p ? { number: p.policyNumber, description: p.policyDescription } : null,
    subPolicy: sp
      ? {
          letter: sp.letter,
          description: sp.description,
          text: sp.text,
        }
      : null,
    subLevel: sl ? { roman: sl.roman, description: sl.description } : null,
  };
}

export function buildActionRecord(
  appVersion: string,
  meta: {
    actionTitle: string;
    department: string;
    primaryContact: ContactBlock;
    alternateContact: ContactBlock;
    howFurthersPolicies: string;
  },
  selected: {
    chapter: Chapter | undefined;
    goal: Goal | undefined;
    goalDetail: GoalDetail | undefined;
    policy: Policy | undefined;
    subPolicy: SubPolicy | undefined;
    subLevel: SubLevel | undefined;
  },
  actionDetails: string,
): ActionRecordPayload {
  const sel: ResolvedSelection = {
    chapter: selected.chapter,
    goal: selected.goal,
    goalDetail: selected.goalDetail,
    policy: selected.policy,
    subPolicy: selected.subPolicy,
    subLevel: selected.subLevel,
    subPolicies: selected.policy?.subPolicies ?? [],
    subLevels: selected.subPolicy?.subLevels ?? [],
  };

  return {
    appVersion,
    exportedAt: new Date().toISOString(),
    actionTitle: meta.actionTitle.trim(),
    department: meta.department.trim(),
    primaryContact: {
      name: meta.primaryContact.name.trim(),
      role: meta.primaryContact.role.trim(),
      email: meta.primaryContact.email.trim(),
      phone: meta.primaryContact.phone.trim(),
    },
    alternateContact: {
      name: meta.alternateContact.name.trim(),
      role: meta.alternateContact.role.trim(),
      email: meta.alternateContact.email.trim(),
      phone: meta.alternateContact.phone.trim(),
    },
    compPlanItems: [compPlanItemFromResolved(sel)],
    actionDetails,
    howFurthersPolicies: meta.howFurthersPolicies.trim(),
  };
}

/** Build export JSON from a draft snapshot and loaded plan (all plan items). */
export function buildActionRecordFromSnapshot(
  plan: PlanData,
  appVersion: string,
  snap: DraftSnapshot,
): ActionRecordPayload {
  const items = (snap.planItems?.length ? snap.planItems : []).map((row) =>
    compPlanItemFromResolved(resolvePlanItem(plan, row)),
  );

  return {
    appVersion,
    exportedAt: new Date().toISOString(),
    actionTitle: snap.actionTitle.trim(),
    department: snap.department.trim(),
    primaryContact: {
      name: snap.primaryContact.name.trim(),
      role: snap.primaryContact.role.trim(),
      email: snap.primaryContact.email.trim(),
      phone: snap.primaryContact.phone.trim(),
    },
    alternateContact: {
      name: snap.alternateContact.name.trim(),
      role: snap.alternateContact.role.trim(),
      email: snap.alternateContact.email.trim(),
      phone: snap.alternateContact.phone.trim(),
    },
    compPlanItems: items,
    actionDetails: snap.actionDetails,
    howFurthersPolicies: snap.howFurthersPolicies.trim(),
  };
}
