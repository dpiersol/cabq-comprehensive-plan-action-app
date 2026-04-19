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

export interface AuthSecurityReport {
  generatedAt: string;
  windowDays: number;
  totals: {
    loginSuccess: number;
    loginFailed: number;
    passwordChange: number;
    userChange: number;
    roleChange: number;
    ssoConfig: number;
    lockouts: number;
  };
  daily: { date: string; counts: Record<string, number> }[];
  failureWatchlist: {
    actor: string;
    failures: number;
    lastAt: string;
    distinctIps: number;
  }[];
  recent: {
    id: number;
    at: string;
    action: string;
    category: string | null;
    actor: string | null;
    target: string | null;
    detail: unknown;
  }[];
}

export function fetchAuthSecurity(days = 30): Promise<AuthSecurityReport> {
  return fetchJson(`/api/admin/reports/auth-security?days=${days}`);
}

/**
 * Triggers a browser download of the audit CSV for the given window.
 * Uses the authenticated fetch + Blob approach because we need to send
 * identity headers that a plain `<a download>` can't attach.
 */
export async function downloadAuthAuditCsv(days = 30): Promise<void> {
  const res = await fetch(
    `/api/admin/reports/auth-audit.csv?days=${days}`,
    { headers: await authHeaders() },
  );
  if (!res.ok) {
    throw new Error(`CSV download failed: ${res.status} ${res.statusText}`);
  }
  const blob = await res.blob();
  const stamp = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `auth-audit-${stamp}-${days}d.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface CoverageReport {
  generatedAt: string;
  planLoaded: boolean;
  totals: {
    chapters: number;
    goals: number;
    policies: number;
    goalsCovered: number;
    policiesCovered: number;
    goalsUncovered: number;
    policiesUncovered: number;
    submissionsMapped: number;
    submissionsUnmapped: number;
  };
  byChapter: {
    chapterIdx: number;
    chapterName: string;
    goalsTotal: number;
    goalsCovered: number;
    submissions: number;
  }[];
  uncoveredGoals: {
    chapterIdx: number;
    goalIdx: number;
    chapterName: string;
    goalName: string;
  }[];
  topGoals: {
    chapterIdx: number;
    goalIdx: number;
    chapterName: string;
    goalName: string;
    count: number;
  }[];
}

export function fetchCoverage(): Promise<CoverageReport> {
  return fetchJson(`/api/admin/reports/coverage`);
}
