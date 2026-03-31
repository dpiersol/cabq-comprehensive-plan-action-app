export interface SubLevel {
  roman: string;
  description: string;
}

export interface SubPolicy {
  letter?: string;
  description?: string;
  text?: string;
  subLevels?: SubLevel[];
}

export interface Policy {
  policyNumber: string;
  policyDescription: string;
  subPolicies: SubPolicy[];
}

export interface GoalDetail {
  detail?: string;
  policies: Policy[];
}

export interface Goal {
  goalNumber: string;
  goalDescription: string;
  goalDetails: GoalDetail[];
}

export interface Chapter {
  chapterNumber: number;
  chapterTitle: string;
  goals: Goal[];
}

export interface PlanData {
  chapters: Chapter[];
}
