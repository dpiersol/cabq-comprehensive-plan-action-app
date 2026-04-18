import { getAuthUser } from "./auth";
import { parseDraftJson } from "./draftStorage";
import type { DraftSnapshot } from "./draftStorage";
import { acquireApiAccessToken } from "./msal/msalInstance";
import type { SavedAction } from "./savedActionsStore";
import type { SubmissionStatus } from "./submissionStatus";

interface SavedActionDto {
  id: string;
  cpRecordId: string;
  status: string;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  snapshot: unknown;
}

async function identityHeaders(): Promise<HeadersInit> {
  const u = getAuthUser();
  if (!u?.email) throw new Error("Not signed in");
  const h: Record<string, string> = {
    "X-User-Email": u.email,
  };
  if (u.oid) h["X-User-Oid"] = u.oid;
  const token = await acquireApiAccessToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function jsonHeaders(): Promise<HeadersInit> {
  const base = (await identityHeaders()) as Record<string, string>;
  return { ...base, "Content-Type": "application/json" };
}

function mapStatus(raw: string): SubmissionStatus {
  return raw === "submitted" ? "submitted" : "draft";
}

function mapDto(row: SavedActionDto): SavedAction {
  return {
    id: row.id,
    cpRecordId: row.cpRecordId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    snapshot: parseDraftJson(row.snapshot),
    status: mapStatus(row.status),
    submittedAt: row.submittedAt,
  };
}

async function readError(res: Response): Promise<string> {
  try {
    const t = await res.text();
    if (!t) return res.statusText;
    try {
      const j = JSON.parse(t) as { error?: string };
      return j.error ?? t;
    } catch {
      return t;
    }
  } catch {
    return res.statusText;
  }
}

export async function listSubmissions(): Promise<SavedAction[]> {
  const res = await fetch("/api/submissions", { headers: await identityHeaders() });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as unknown;
  if (!Array.isArray(body)) throw new Error("Invalid list response");
  return body.map((x) => mapDto(x as SavedActionDto));
}

export async function getSubmission(id: string): Promise<SavedAction | null> {
  const res = await fetch(`/api/submissions/${encodeURIComponent(id)}`, {
    headers: await identityHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as SavedActionDto;
  return mapDto(body);
}

export async function createSubmission(
  snapshot: DraftSnapshot,
  opts?: { status?: SubmissionStatus },
): Promise<SavedAction> {
  const status = opts?.status ?? "draft";
  const res = await fetch("/api/submissions", {
    method: "POST",
    headers: await jsonHeaders(),
    body: JSON.stringify({ snapshot, status }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as SavedActionDto;
  return mapDto(body);
}

export async function patchSubmission(
  id: string,
  patch: { snapshot?: DraftSnapshot; status?: SubmissionStatus },
): Promise<SavedAction | null> {
  const body: Record<string, unknown> = {};
  if (patch.snapshot !== undefined) body.snapshot = patch.snapshot;
  if (patch.status !== undefined) body.status = patch.status;
  const res = await fetch(`/api/submissions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: await jsonHeaders(),
    body: JSON.stringify(body),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readError(res));
  const row = (await res.json()) as SavedActionDto;
  return mapDto(row);
}

/** @deprecated Use patchSubmission — kept for gradual migration */
export async function updateSubmission(
  id: string,
  snapshot: DraftSnapshot,
): Promise<SavedAction | null> {
  return patchSubmission(id, { snapshot });
}

export async function deleteSubmission(id: string): Promise<boolean> {
  const res = await fetch(`/api/submissions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: await identityHeaders(),
  });
  if (res.status === 404) return false;
  if (res.status === 409) throw new Error(await readError(res));
  if (!res.ok) throw new Error(await readError(res));
  return true;
}
