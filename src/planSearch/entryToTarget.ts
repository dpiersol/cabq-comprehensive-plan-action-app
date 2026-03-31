import type { HierarchyJumpTarget, PlanSearchEntry } from "./types";

export function planSearchEntryToTarget(entry: PlanSearchEntry): HierarchyJumpTarget {
  return {
    chapterIdx: entry.chapterIdx,
    goalIdx: entry.goalIdx,
    goalDetailIdx: entry.goalDetailIdx,
    policyIdx: entry.policyIdx,
    subPolicyIdx: entry.subPolicyIdx,
    subLevelIdx: entry.subLevelIdx,
  };
}
