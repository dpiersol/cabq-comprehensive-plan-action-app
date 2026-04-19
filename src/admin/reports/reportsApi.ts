import { getAuthUser } from "../../auth";
import { getLocalAccessToken } from "../../auth/localSession";
import { acquireApiAccessToken } from "../../msal/msalInstance";

export interface SubmissionsOverview {
  generatedAt: string;
  kpis: {
    total: number;
    draft: number;
    submitted: number;
    createdLast7d: number;
    createdLast30d: number;
    submittedLast7d: number;
    submittedLast30d: number;
  };
  weekly: { weekStart: string; count: number }[];
  topGoals: { chapterIdx: number; goalIdx: number; count: number }[];
  unmapped: number;
}

export interface UserActivityLocalRow {
  id: string;
  username: string;
  email: string;
  displayName: string;
  roles: string[];
  isActive: boolean;
  isLocked: boolean;
  lastLoginAt: string | null;
  daysSinceLogin: number | null;
  submissionsTotal: number;
  submissionsSubmitted: number;
  submissionsDraft: number;
  lastSubmissionAt: string | null;
}

export interface UserActivityNonLocalRow {
  email: string;
  submissionsTotal: number;
  submissionsSubmitted: number;
  submissionsDraft: number;
  lastSubmissionAt: string | null;
}

export interface UserActivityReport {
  generatedAt: string;
  localUsers: UserActivityLocalRow[];
  nonLocalSubmitters: UserActivityNonLocalRow[];
  totals: {
    localUsers: number;
    activeLocalUsers: number;
    admins: number;
    dormant90d: number;
  };
}

async function authHeaders(): Promise<Record<string, string>> {
  const u = getAuthUser();
  const h: Record<string, string> = {};
  if (u?.email) h["X-User-Email"] = u.email;
  if (u?.oid) h["X-User-Oid"] = u.oid;
  if (u?.roles?.length) h["X-User-Roles"] = u.roles.join(",");
  const local = getLocalAccessToken();
  if (local) h.Authorization = `Bearer ${local}`;
  else {
    const token = await acquireApiAccessToken();
    if (token) h.Authorization = `Bearer ${token}`;
  }
  return h;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: await authHeaders() });
  if (!res.ok) {
    throw new Error(`${url} → ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export function fetchSubmissionsOverview(weeks = 13): Promise<SubmissionsOverview> {
  return fetchJson(`/api/admin/reports/submissions-overview?weeks=${weeks}`);
}

export function fetchUserActivity(): Promise<UserActivityReport> {
  return fetchJson(`/api/admin/reports/user-activity`);
}
