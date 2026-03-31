import type { Chapter, Goal, GoalDetail, PlanData, Policy, SubLevel, SubPolicy } from "./types";
import type { DraftSnapshot } from "./draftStorage";

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

/** Resolve plan hierarchy objects from flat indices and loaded plan data. */
export function resolveSelection(plan: PlanData, snap: DraftSnapshot): ResolvedSelection {
  const chapters = plan.chapters;
  const chapter =
    snap.chapterIdx >= 0 && snap.chapterIdx < chapters.length
      ? chapters[snap.chapterIdx]
      : undefined;
  const goals = chapter?.goals ?? [];
  const goal =
    snap.goalIdx >= 0 && snap.goalIdx < goals.length ? goals[snap.goalIdx] : undefined;
  const goalDetails = goal?.goalDetails ?? [];
  const goalDetail =
    snap.goalDetailIdx >= 0 && snap.goalDetailIdx < goalDetails.length
      ? goalDetails[snap.goalDetailIdx]
      : undefined;
  const policies = goalDetail?.policies ?? [];
  const policy =
    snap.policyIdx >= 0 && snap.policyIdx < policies.length ? policies[snap.policyIdx] : undefined;
  const subPolicies = policy?.subPolicies ?? [];
  const subPolicy =
    snap.subPolicyIdx >= 0 && snap.subPolicyIdx < subPolicies.length
      ? subPolicies[snap.subPolicyIdx]
      : undefined;
  const subLevels = subPolicy?.subLevels ?? [];
  const subLevel =
    snap.subLevelIdx >= 0 && snap.subLevelIdx < subLevels.length
      ? subLevels[snap.subLevelIdx]
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
