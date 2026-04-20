import type { PlanData } from "./types";
import type { DraftSnapshot } from "./draftStorage";
import { buildSubmissionPdfPayload } from "./submissionMerge";

/** POST /api/submissions/pdf (anonymous) — saves a `.pdf` file locally. */
export async function downloadSubmissionPdf(
  plan: PlanData,
  snap: DraftSnapshot,
  filename: string,
): Promise<void> {
  const payload = buildSubmissionPdfPayload(plan, snap);
  const res = await fetch("/api/submissions/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `PDF export failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
