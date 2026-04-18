import { getAuthUser } from "./auth";
import { parseDraftJson } from "./draftStorage";
import type { DraftSnapshot } from "./draftStorage";
import type { SavedAction } from "./savedActionsStore";

interface SavedActionDto {
  id: string;
  cpRecordId: string;
  createdAt: string;
  updatedAt: string;
  snapshot: unknown;
}

function identityHeaders(): HeadersInit {
  const u = getAuthUser();
  if (!u?.email) throw new Error("Not signed in");
  const h: Record<string, string> = {
    "X-User-Email": u.email,
  };
  if (u.oid) h["X-User-Oid"] = u.oid;
  return h;
}

function jsonHeaders(): HeadersInit {
  const h = identityHeaders() as Record<string, string>;
  h["Content-Type"] = "application/json";
  return h;
}

function mapDto(row: SavedActionDto): SavedAction {
  return {
    id: row.id,
    cpRecordId: row.cpRecordId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    snapshot: parseDraftJson(row.snapshot),
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
  const res = await fetch("/api/submissions", { headers: identityHeaders() });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as unknown;
  if (!Array.isArray(body)) throw new Error("Invalid list response");
  return body.map((x) => mapDto(x as SavedActionDto));
}

export async function getSubmission(id: string): Promise<SavedAction | null> {
  const res = await fetch(`/api/submissions/${encodeURIComponent(id)}`, {
    headers: identityHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as SavedActionDto;
  return mapDto(body);
}

export async function createSubmission(snapshot: DraftSnapshot): Promise<SavedAction> {
  const res = await fetch("/api/submissions", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ snapshot }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as SavedActionDto;
  return mapDto(body);
}

export async function updateSubmission(id: string, snapshot: DraftSnapshot): Promise<SavedAction | null> {
  const res = await fetch(`/api/submissions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify({ snapshot }),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as SavedActionDto;
  return mapDto(body);
}

export async function deleteSubmission(id: string): Promise<boolean> {
  const res = await fetch(`/api/submissions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: identityHeaders(),
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(await readError(res));
  return true;
}
