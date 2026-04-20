import { getAuthUser } from "../auth";
import { getLocalAccessToken } from "../auth/localSession";
import { parseDraftJson, type DraftSnapshot } from "../draftStorage";
import { acquireApiAccessToken } from "../msal/msalInstance";
import type { SavedAction } from "../savedActionsStore";
import type { SubmissionStatus } from "../submissionStatus";

export interface AdminSavedAction extends SavedAction {
  ownerEmail: string;
}

interface AdminSavedActionDto {
  id: string;
  cpRecordId: string;
  status: string;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  snapshot: unknown;
  ownerEmail: string;
}

async function identityHeaders(): Promise<HeadersInit> {
  const u = getAuthUser();
  if (!u?.email) throw new Error("Not signed in");
  const h: Record<string, string> = {
    "X-User-Email": u.email,
  };
  if (u.oid) h["X-User-Oid"] = u.oid;
  if (u.roles?.length) h["X-User-Roles"] = u.roles.join(",");
  // Prefer local-session JWT when present, otherwise fall back to Entra silent token.
  const local = getLocalAccessToken();
  if (local) {
    h.Authorization = `Bearer ${local}`;
  } else {
    const token = await acquireApiAccessToken();
    if (token) h.Authorization = `Bearer ${token}`;
  }
  return h;
}

async function jsonHeaders(): Promise<HeadersInit> {
  const base = (await identityHeaders()) as Record<string, string>;
  return { ...base, "Content-Type": "application/json" };
}

function mapStatus(raw: string): SubmissionStatus {
  return raw === "submitted" ? "submitted" : "draft";
}

function mapDto(row: AdminSavedActionDto): AdminSavedAction {
  return {
    id: row.id,
    cpRecordId: row.cpRecordId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    snapshot: parseDraftJson(row.snapshot),
    status: mapStatus(row.status),
    submittedAt: row.submittedAt,
    ownerEmail: row.ownerEmail,
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

export class AdminApiUnavailable extends Error {}

/**
 * Admin endpoints are only available when the backend is running. Network / 404 errors
 * surface as `AdminApiUnavailable` so the UI can fall back to the localStorage seed.
 */
export async function listAdminSubmissions(): Promise<AdminSavedAction[]> {
  let res: Response;
  try {
    res = await fetch("/api/admin/submissions", { headers: await identityHeaders() });
  } catch (err) {
    throw new AdminApiUnavailable(err instanceof Error ? err.message : "Network error");
  }
  if (res.status === 404) throw new AdminApiUnavailable("Admin API not available");
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as unknown;
  if (!Array.isArray(body)) throw new Error("Invalid list response");
  return body.map((x) => mapDto(x as AdminSavedActionDto));
}

export async function getAdminSubmission(id: string): Promise<AdminSavedAction | null> {
  let res: Response;
  try {
    res = await fetch(`/api/admin/submissions/${encodeURIComponent(id)}`, {
      headers: await identityHeaders(),
    });
  } catch (err) {
    throw new AdminApiUnavailable(err instanceof Error ? err.message : "Network error");
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as AdminSavedActionDto;
  return mapDto(body);
}

export async function patchAdminSubmission(
  id: string,
  patch: { snapshot?: DraftSnapshot; status?: SubmissionStatus },
): Promise<AdminSavedAction | null> {
  const body: Record<string, unknown> = {};
  if (patch.snapshot !== undefined) body.snapshot = patch.snapshot;
  if (patch.status !== undefined) body.status = patch.status;
  const res = await fetch(`/api/admin/submissions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: await jsonHeaders(),
    body: JSON.stringify(body),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readError(res));
  const row = (await res.json()) as AdminSavedActionDto;
  return mapDto(row);
}
