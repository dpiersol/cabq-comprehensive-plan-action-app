/** Indices into the loaded plan tree; -1 means “not selected”. */
export interface HierarchyJumpTarget {
  chapterIdx: number;
  goalIdx: number;
  goalDetailIdx: number;
  policyIdx: number;
  subPolicyIdx: number;
  subLevelIdx: number;
}

export type PlanSearchLevel =
  | "chapter"
  | "goal"
  | "goalDetail"
  | "policy"
  | "subPolicy"
  | "subLevel";

export interface PlanSearchEntry {
  /** Stable id for React keys. */
  id: string;
  level: PlanSearchLevel;
  chapterIdx: number;
  goalIdx: number;
  goalDetailIdx: number;
  policyIdx: number;
  subPolicyIdx: number;
  subLevelIdx: number;
  /** Full path for display. */
  breadcrumb: string;
  /** Short line describing this hit. */
  label: string;
  /** Lowercased text used for matching (tokens must all appear as substrings). */
  searchBlob: string;
}

export interface PlanSearchHit {
  entry: PlanSearchEntry;
  score: number;
}
