import type { Chapter, Goal, GoalDetail, PlanData, Policy, SubLevel, SubPolicy } from "./types";
import type { DraftSnapshot, PlanItemSelection } from "./draftStorage";
import { emptyPlanItem } from "./draftStorage";

export interface ResolvedSelection {
  chapter: Chapter | undefined;
  goal: Goal | undefined;
  goalDetail: GoalDetail | undefined;
  policy: Policy | undefined;
  subPolicy: SubPolicy | undefined;
  subLevel: SubLevel | undefined;
  subPolicies: SubPolicy[];
  subLevels: SubLevel[];
}

/** Resolve plan hierarchy objects from one plan-item row. */
export function resolvePlanItem(plan: PlanData, item: PlanItemSelection): ResolvedSelection {
  const chapters = plan.chapters;
  const chapter =
    item.chapterIdx >= 0 && item.chapterIdx < chapters.length
      ? chapters[item.chapterIdx]
      : undefined;
  const goals = chapter?.goals ?? [];
  const goal = item.goalIdx >= 0 && item.goalIdx < goals.length ? goals[item.goalIdx] : undefined;
  const goalDetails = goal?.goalDetails ?? [];
  const goalDetail =
    item.goalDetailIdx >= 0 && item.goalDetailIdx < goalDetails.length
      ? goalDetails[item.goalDetailIdx]
      : undefined;
  const policies = goalDetail?.policies ?? [];
  const policy =
    item.policyIdx >= 0 && item.policyIdx < policies.length ? policies[item.policyIdx] : undefined;
  const subPolicies = policy?.subPolicies ?? [];
  const subPolicy =
    item.subPolicyIdx >= 0 && item.subPolicyIdx < subPolicies.length
      ? subPolicies[item.subPolicyIdx]
      : undefined;
  const subLevels = subPolicy?.subLevels ?? [];
  const subLevel =
    item.subLevelIdx >= 0 && item.subLevelIdx < subLevels.length
      ? subLevels[item.subLevelIdx]
      : undefined;

  return {
    chapter,
    goal,
    goalDetail,
    policy,
    subPolicy,
    subLevel,
    subPolicies,
    subLevels,
  };
}

/**
 * Resolve the first plan item (library table / backward-compatible helpers).
 * Prefer `resolvePlanItem` when iterating `snapshot.planItems`.
 */
export function resolveSelection(plan: PlanData, snap: DraftSnapshot): ResolvedSelection {
  const first = snap.planItems?.[0] ?? emptyPlanItem();
  return resolvePlanItem(plan, first);
}
