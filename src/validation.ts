import type { PlanData } from "./types";
import type { DraftSnapshot } from "./draftStorage";
import { resolveSelection } from "./planSelection";

const ACTION_TITLE_MIN = 3;
const ACTION_DETAILS_MIN = 10;
export const ACTION_DETAILS_MAX = 500;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateDraftForSave(plan: PlanData, snap: DraftSnapshot): ValidationResult {
  const errors: string[] = [];
  const actionTitle = snap.actionTitle.trim();
  if (actionTitle.length < ACTION_TITLE_MIN) {
    errors.push(`Action title must be at least ${ACTION_TITLE_MIN} characters.`);
  }

  const action = snap.actionDetails.trim();
  if (action.length < ACTION_DETAILS_MIN) {
    errors.push(`Action description must be at least ${ACTION_DETAILS_MIN} characters.`);
  }
  if (action.length > ACTION_DETAILS_MAX) {
    errors.push(`Action description must be at most ${ACTION_DETAILS_MAX} characters.`);
  }

  const sel = resolveSelection(plan, snap);
  if (!sel.chapter) errors.push("Select a chapter.");
  if (!sel.goal) errors.push("Select a goal.");
  if (!sel.goalDetail) errors.push("Select a goal detail.");
  if (!sel.policy) errors.push("Select a policy.");

  if (sel.policy && sel.subPolicies.length > 0 && !sel.subPolicy) {
    errors.push("Select a sub-policy for this policy.");
  }

  if (sel.subPolicy && sel.subLevels.length > 0 && !sel.subLevel) {
    errors.push("Select a sub-policy sub-level.");
  }

  return { ok: errors.length === 0, errors };
}

export function validateDraftForExport(plan: PlanData, snap: DraftSnapshot): ValidationResult {
  const errors: string[] = [];
  const sel = resolveSelection(plan, snap);
  if (!sel.chapter) errors.push("Select a chapter.");
  if (!sel.goal) errors.push("Select a goal.");
  if (!sel.goalDetail) errors.push("Select a goal detail.");
  if (!sel.policy) errors.push("Select a policy.");
  if (sel.policy && sel.subPolicies.length > 0 && !sel.subPolicy) {
    errors.push("Select a sub-policy for this policy.");
  }
  if (sel.subPolicy && sel.subLevels.length > 0 && !sel.subLevel) {
    errors.push("Select a sub-policy sub-level.");
  }
  const action = snap.actionDetails.trim();
  if (action.length > ACTION_DETAILS_MAX) {
    errors.push(`Action description must be at most ${ACTION_DETAILS_MAX} characters.`);
  }
  return { ok: errors.length === 0, errors };
}
