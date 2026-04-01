import type { SubPolicy } from "./types";

/** Stable label for dropdown options and summaries. */
export function subPolicyOptionLabel(sp: SubPolicy, index: number): string {
  const preview =
    sp.text?.trim() ||
    sp.description?.trim() ||
    "";
  const head = preview.length > 140 ? `${preview.slice(0, 137)}…` : preview;
  if (sp.letter) {
    return head ? `${sp.letter}. ${head}` : `${sp.letter}. (no text)`;
  }
  if (head) return head;
  return `Sub-policy ${index + 1}`;
}

export function chapterLabel(c: { chapterNumber: number; chapterTitle: string }): string {
  return `${c.chapterNumber} — ${c.chapterTitle}`;
}

export function goalLabel(g: { goalNumber: string; goalDescription: string }): string {
  return `${g.goalNumber} — ${g.goalDescription}`;
}

export function policyLabel(p: { policyNumber: string; policyDescription: string }): string {
  return `${p.policyNumber} — ${p.policyDescription}`;
}

/** Plan JSON may contain null cells from Excel (e.g. `roman: null`). */
export function subLevelLabel(sl: {
  roman?: string | null;
  description?: string | null;
}): string {
  const r = (sl.roman ?? "").trim();
  const d = (sl.description ?? "").trim();
  if (d) return r ? `${r} ${d}` : d;
  return r || "(Sub-level)";
}
