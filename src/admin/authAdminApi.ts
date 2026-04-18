import { getAuthUser } from "../auth";
import { getLocalAccessToken } from "../auth/localSession";
import { acquireApiAccessToken } from "../msal/msalInstance";

export interface PublicAuthConfig {
  sso: {
    enabled: boolean;
    tenantId: string | null;
    clientId: string | null;
    authority: string | null;
    allowedEmailDomains: string[];
  };
  local: { enabled: boolean };
}

export interface AdminAuthConfig {
  sso: {
    enabled: boolean;
    tenantId: string | null;
    clientId: string | null;
    audience: string | null;
    issuer: string | null;
    allowedEmailDomains: string[];
    adminRoleNames: string[];
    adminEmails: string[];
  };
  local: { enabled: boolean; configured: boolean };
}

export interface LocalUserDto {
  id: string;
  username: string;
  email: string;
  displayName: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  isLocked: boolean;
  failedAttempts: number;
  lockedUntil: string | null;
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RoleDto {
  name: string;
  description: string | null;
  isBuiltin: boolean;
  memberCount: number;
}

export interface AuditEntry {
  id: number;
  actor: string | null;
  action: string;
  target: string | null;
  detail: string | null;
  at: string;
}

async function authHeaders(): Promise<HeadersInit> {
  const u = getAuthUser();
  if (!u?.email) throw new Error("Not signed in");
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    "X-User-Email": u.email,
  };
  if (u.oid) h["X-User-Oid"] = u.oid;
  if (u.roles?.length) h["X-User-Roles"] = u.roles.join(",");
  const local = getLocalAccessToken();
  if (local) {
    h.Authorization = `Bearer ${local}`;
  } else {
    const token = await acquireApiAccessToken();
    if (token) h.Authorization = `Bearer ${token}`;
  }
  return h;
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

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as T;
}

export async function fetchPublicAuthConfig(): Promise<PublicAuthConfig> {
  const res = await fetch("/api/auth/config");
  return json<PublicAuthConfig>(res);
}

export async function fetchAdminAuthConfig(): Promise<AdminAuthConfig> {
  const res = await fetch("/api/admin/auth/config", { headers: await authHeaders() });
  return json<AdminAuthConfig>(res);
}

export async function patchAdminAuthConfig(
  patch: Partial<AdminAuthConfig["sso"]> & { ssoEnabled?: boolean; localEnabled?: boolean },
): Promise<AdminAuthConfig> {
  const res = await fetch("/api/admin/auth/config", {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(patch),
  });
  return json<AdminAuthConfig>(res);
}

export async function testSsoToken(body: {
  token: string;
  tenantId?: string;
  audience?: string;
  issuer?: string;
}): Promise<{ ok: boolean; payload?: unknown; error?: string }> {
  const res = await fetch("/api/admin/auth/test-sso", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  if (res.ok) return (await res.json()) as { ok: true; payload: unknown };
  try {
    return (await res.json()) as { ok: false; error: string };
  } catch {
    return { ok: false, error: res.statusText };
  }
}

export async function listLocalUsers(): Promise<LocalUserDto[]> {
  const res = await fetch("/api/admin/users", { headers: await authHeaders() });
  return json<LocalUserDto[]>(res);
}

export async function createLocalUser(input: {
  username: string;
  email: string;
  displayName: string;
  password: string;
  roles: string[];
  mustChangePassword?: boolean;
}): Promise<LocalUserDto> {
  const res = await fetch("/api/admin/users", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(input),
  });
  return json<LocalUserDto>(res);
}

export async function patchLocalUser(
  id: string,
  patch: Partial<{
    displayName: string;
    email: string;
    isActive: boolean;
    mustChangePassword: boolean;
    roles: string[];
  }>,
): Promise<LocalUserDto> {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify(patch),
  });
  return json<LocalUserDto>(res);
}

export async function deleteLocalUser(id: string): Promise<void> {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(await readError(res));
}

export async function resetLocalUserPassword(id: string, password: string): Promise<void> {
  const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}/reset-password`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(await readError(res));
}

export async function listRoles(): Promise<{ roles: RoleDto[]; adminCount: number }> {
  const res = await fetch("/api/admin/roles", { headers: await authHeaders() });
  return json<{ roles: RoleDto[]; adminCount: number }>(res);
}

export async function createRole(name: string, description: string | null): Promise<void> {
  const res = await fetch("/api/admin/roles", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) throw new Error(await readError(res));
}

export async function deleteRole(name: string): Promise<void> {
  const res = await fetch(`/api/admin/roles/${encodeURIComponent(name)}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error(await readError(res));
}

export async function fetchAuditLog(
  opts: { limit?: number; beforeId?: number; action?: string } = {},
): Promise<AuditEntry[]> {
  const qs = new URLSearchParams();
  if (opts.limit) qs.set("limit", String(opts.limit));
  if (opts.beforeId) qs.set("beforeId", String(opts.beforeId));
  if (opts.action) qs.set("action", opts.action);
  const url = qs.toString() ? `/api/admin/auth/audit?${qs}` : "/api/admin/auth/audit";
  const res = await fetch(url, { headers: await authHeaders() });
  return json<AuditEntry[]>(res);
}
