import type { PlanData } from "./types";
import type { DraftSnapshot } from "./draftStorage";
import { resolvePlanItem } from "./planSelection";
import { chapterLabel, goalLabel, policyLabel } from "./labels";
import { plainTextFromHtml } from "./htmlUtils";

/** Payload sent to `POST /api/submissions/pdf` (mirrors Word template placeholders). */
export interface SubmissionPdfPayload {
  currentDate: string;
  legislationTitle: string;
  chapter: string;
  goal: string;
  policy: string;
  legislationDescription: string;
  howDoesLegislationFurtherPolicies: string;
}

function joinDistinct(lines: string[], sep = "; "): string {
  const u = [...new Set(lines.map((s) => s.trim()).filter(Boolean))];
  return u.length ? u.join(sep) : "—";
}

/**
 * Builds merge fields for PDF (and future Word) from the draft and plan data.
 */
export function buildSubmissionPdfPayload(plan: PlanData, snap: DraftSnapshot): SubmissionPdfPayload {
  const items = snap.planItems?.length ? snap.planItems : [];
  const chapters: string[] = [];
  const goals: string[] = [];
  const policies: string[] = [];

  for (const row of items) {
    const sel = resolvePlanItem(plan, row);
    if (sel.chapter) chapters.push(chapterLabel(sel.chapter));
    if (sel.goal) goals.push(goalLabel(sel.goal));
    if (sel.policy) policies.push(policyLabel(sel.policy));
  }

  const currentDate = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return {
    currentDate,
    legislationTitle: snap.actionTitle.trim() || "—",
    chapter: joinDistinct(chapters),
    goal: joinDistinct(goals),
    policy: joinDistinct(policies),
    legislationDescription: plainTextFromHtml(snap.actionDetails) || "—",
    howDoesLegislationFurtherPolicies: snap.howFurthersPolicies.trim() || "—",
  };
}
