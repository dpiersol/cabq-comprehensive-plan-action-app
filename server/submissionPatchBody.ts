import { snapshotFromRequestBody, validateSnapshotObject } from "./snapshotValidate.js";

export type SubmissionStatus = "draft" | "submitted";

export interface CreateSubmissionBody {
  snapshot: unknown;
  status: SubmissionStatus;
}

export function parseCreateBody(body: unknown): CreateSubmissionBody {
  const snap = snapshotFromRequestBody(body);
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object");
  }
  const o = body as Record<string, unknown>;
  const raw = o.status;
  if (raw === undefined || raw === null) {
    return { snapshot: snap, status: "draft" };
  }
  if (raw !== "draft" && raw !== "submitted") {
    throw new Error('status must be "draft" or "submitted"');
  }
  return { snapshot: snap, status: raw };
}

export interface PatchSubmissionBody {
  snapshot?: unknown;
  status?: SubmissionStatus;
}

/** PATCH accepts partial updates; at least one of snapshot or status must be present. */
export function parsePatchBody(body: unknown): PatchSubmissionBody {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object");
  }
  const o = body as Record<string, unknown>;
  const out: PatchSubmissionBody = {};
  if ("snapshot" in o) {
    out.snapshot = validateSnapshotObject(o.snapshot);
  }
  if ("status" in o && o.status !== undefined && o.status !== null) {
    const s = o.status;
    if (s !== "draft" && s !== "submitted") {
      throw new Error('status must be "draft" or "submitted"');
    }
    out.status = s;
  }
  if (out.snapshot === undefined && out.status === undefined) {
    throw new Error("Provide snapshot and/or status");
  }
  return out;
}
