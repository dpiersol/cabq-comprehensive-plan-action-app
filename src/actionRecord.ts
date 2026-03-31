import type { Chapter, Goal, GoalDetail, PlanData, Policy, SubLevel, SubPolicy } from "./types";
import type { DraftSnapshot } from "./draftStorage";
import { resolveSelection } from "./planSelection";

export interface ActionRecordPayload {
  appVersion: string;
  exportedAt: string;
  recordTitle: string;
  department: string;
  referenceId: string;
  chapter: { number: number; title: string } | null;
  goal: { number: string; description: string } | null;
  goalDetail: string | null;
  policy: { number: string; description: string } | null;
  subPolicy: {
    letter?: string;
    description?: string;
    text?: string;
  } | null;
  subLevel: { roman: string; description: string } | null;
  actionDetails: string;
}

export function buildActionRecord(
  appVersion: string,
  meta: { title: string; department: string; referenceId: string },
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
  const c = selected.chapter;
  const g = selected.goal;
  const gd = selected.goalDetail;
  const p = selected.policy;
  const sp = selected.subPolicy;
  const sl = selected.subLevel;

  return {
    appVersion,
    exportedAt: new Date().toISOString(),
    recordTitle: meta.title.trim(),
    department: meta.department.trim(),
    referenceId: meta.referenceId.trim(),
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
    actionDetails,
  };
}

/** Build a record from a full draft snapshot and plan data (single export path). */
export function buildActionRecordFromSnapshot(
  plan: PlanData,
  appVersion: string,
  snap: DraftSnapshot,
): ActionRecordPayload {
  const sel = resolveSelection(plan, snap);
  return buildActionRecord(
    appVersion,
    { title: snap.title, department: snap.department, referenceId: snap.referenceId },
    {
      chapter: sel.chapter,
      goal: sel.goal,
      goalDetail: sel.goalDetail,
      policy: sel.policy,
      subPolicy: sel.subPolicy,
      subLevel: sel.subLevel,
    },
    snap.actionDetails,
  );
}
