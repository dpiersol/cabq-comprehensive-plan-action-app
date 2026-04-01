import type { PlanData } from "./types";
import type { DraftSnapshot } from "./draftStorage";
import type { ContactBlock } from "./contacts";
import { resolveSelection } from "./planSelection";
import { plainTextFromHtml } from "./htmlUtils";

const ACTION_TITLE_MIN = 3;
const ACTION_DETAILS_MIN = 10;
export const ACTION_DETAILS_MAX = 500;

/** Loose email check for required primary contact. */
function isValidEmail(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

/** At least 7 digits (allows formatted numbers). */
function phoneHasEnoughDigits(s: string): boolean {
  return s.replace(/\D/g, "").length >= 7;
}

/** Primary contact: all fields required for save/export. */
export function validatePrimaryContact(c: ContactBlock): string[] {
  const errors: string[] = [];
  if (!c.name.trim()) errors.push("Enter the primary contact's name.");
  if (!c.role.trim()) errors.push("Enter the primary contact's role.");
  if (!isValidEmail(c.email)) errors.push("Enter a valid email address for the primary contact.");
  if (!phoneHasEnoughDigits(c.phone)) {
    errors.push("Enter a phone number for the primary contact (at least 7 digits).");
  }
  return errors;
}

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

  const actionPlain = plainTextFromHtml(snap.actionDetails);
  if (actionPlain.length < ACTION_DETAILS_MIN) {
    errors.push(`Action description must be at least ${ACTION_DETAILS_MIN} characters.`);
  }
  if (actionPlain.length > ACTION_DETAILS_MAX) {
    errors.push(`Action description must be at most ${ACTION_DETAILS_MAX} characters.`);
  }

  const sel = resolveSelection(plan, snap);
  if (!sel.chapter) errors.push("Select a chapter.");
  if (!sel.goal) errors.push("Select a goal.");
  if (!sel.goalDetail) errors.push("Select a goal detail.");
  if (!sel.policy) errors.push("Select a policy.");
  errors.push(...validatePrimaryContact(snap.primaryContact));

  return { ok: errors.length === 0, errors };
}

export function validateDraftForExport(plan: PlanData, snap: DraftSnapshot): ValidationResult {
  const errors: string[] = [];
  const actionTitle = snap.actionTitle.trim();
  if (actionTitle.length < ACTION_TITLE_MIN) {
    errors.push(`Action title must be at least ${ACTION_TITLE_MIN} characters.`);
  }

  const actionPlain = plainTextFromHtml(snap.actionDetails);
  if (actionPlain.length < ACTION_DETAILS_MIN) {
    errors.push(`Action description must be at least ${ACTION_DETAILS_MIN} characters.`);
  }
  if (actionPlain.length > ACTION_DETAILS_MAX) {
    errors.push(`Action description must be at most ${ACTION_DETAILS_MAX} characters.`);
  }

  const sel = resolveSelection(plan, snap);
  if (!sel.chapter) errors.push("Select a chapter.");
  if (!sel.goal) errors.push("Select a goal.");
  if (!sel.goalDetail) errors.push("Select a goal detail.");
  if (!sel.policy) errors.push("Select a policy.");
  errors.push(...validatePrimaryContact(snap.primaryContact));
  return { ok: errors.length === 0, errors };
}
