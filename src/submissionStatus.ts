/** Lifecycle state for server-backed submissions (SQLite `submissions.status`). */

export type SubmissionStatus = "draft" | "submitted";

export function submissionStatusLabel(s: SubmissionStatus | undefined): string {
  if (s === "submitted") return "Submitted";
  return "Draft";
}

export function isSubmitted(s: SubmissionStatus | undefined): boolean {
  return s === "submitted";
}
