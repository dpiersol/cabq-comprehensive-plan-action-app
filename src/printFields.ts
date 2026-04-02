import type { PlanData } from "./types";
import type { DraftSnapshot } from "./draftStorage";
import { resolvePlanItem } from "./planSelection";
import { chapterLabel, goalLabel, policyLabel } from "./labels";
import { plainTextFromHtml } from "./htmlUtils";

/**
 * The 11 fields that map to the Word print template placeholders.
 *
 *  1  {Current Date}
 *  2  {Department Name}
 *  3  {Legislation Title}
 *  4  {Chapter Number}
 *  5  {Chapter Description}
 *  6  {Goal}
 *  7  {Goal Description}
 *  8  {Policy}
 *  9  {Policy Description}
 * 10  {Legislation Description}
 * 11  {How does this legislation further the policies selected?}
 */
export interface PrintFields {
  currentDate: string;
  departmentName: string;
  legislationTitle: string;
  chapterNumber: string;
  chapterDescription: string;
  goal: string;
  goalDescription: string;
  policy: string;
  policyDescription: string;
  legislationDescription: string;
  howFurthers: string;
}

function splitLabel(s: string): { head: string; tail: string } {
  const t = s.trim();
  for (const sep of [" — ", " – ", " - "]) {
    const i = t.indexOf(sep);
    if (i >= 0) return { head: t.slice(0, i).trim(), tail: t.slice(i + sep.length).trim() };
  }
  return { head: t, tail: "" };
}

function joinDistinct(lines: string[], sep = "; "): string {
  const u = [...new Set(lines.map((s) => s.trim()).filter(Boolean))];
  return u.length ? u.join(sep) : "";
}

export function buildPrintFields(plan: PlanData, snap: DraftSnapshot): PrintFields {
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

  const chapterCombined = joinDistinct(chapters);
  const goalCombined = joinDistinct(goals);
  const policyCombined = joinDistinct(policies);

  const ch = splitLabel(chapterCombined);
  const g = splitLabel(goalCombined);
  const p = splitLabel(policyCombined);

  return {
    currentDate: new Date().toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    departmentName: snap.department.trim(),
    legislationTitle: snap.actionTitle.trim(),
    chapterNumber: ch.head,
    chapterDescription: ch.tail,
    goal: g.head,
    goalDescription: g.tail,
    policy: p.head,
    policyDescription: p.tail,
    legislationDescription: plainTextFromHtml(snap.actionDetails),
    howFurthers: snap.howFurthersPolicies.trim(),
  };
}
