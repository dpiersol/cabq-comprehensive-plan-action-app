/**
 * Client-side session view of the signed-in user (Entra ID or dev mock).
 * API calls in later sprints must send the access token; this store is for UI (nav, role hints) only.
 */

export interface AuthUser {
  displayName: string;
  email: string;
  /** Entra app roles and group role claims copied from the ID token. */
  roles: string[];
  /** Object ID in Microsoft Entra. */
  oid?: string;
  /** Tenant (home) id. */
  tenantId?: string;
}

const listeners = new Set<() => void>();

let currentUser: AuthUser | null = null;

function notify() {
  for (const fn of listeners) fn();
}

export function getAuthUser(): AuthUser | null {
  return currentUser;
}

/** Role names that grant admin UX (comma-separated env, or sensible defaults). */
export function adminRoleNames(): string[] {
  const raw = import.meta.env.VITE_ENTRA_ROLE_ADMIN;
  if (typeof raw === "string" && raw.trim()) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return ["comp-plan-admin", "Application.Admin", "Admin"];
}

export function isAdmin(): boolean {
  const roles = adminRoleNames();
  return currentUser?.roles.some((r) => roles.includes(r)) ?? false;
}

export function setAuthUser(user: AuthUser | null): void {
  currentUser = user;
  notify();
}

/** Development-only mock sign-in as a standard city user. */
export function loginMockCityUser(): void {
  currentUser = {
    displayName: "Dev City User",
    email: "dev.user@cabq.gov",
    roles: ["Application.User"],
    oid: "mock-user-oid",
    tenantId: "mock-tenant",
  };
  notify();
}

/** Development-only mock sign-in as admin (links to Admin Console when wired). */
export function loginMockAdmin(): void {
  currentUser = {
    displayName: "Dev Admin",
    email: "dev.admin@cabq.gov",
    roles: ["comp-plan-admin"],
    oid: "mock-admin-oid",
    tenantId: "mock-tenant",
  };
  notify();
}

/** Back-compat alias with previous placeholder API name. */
export function loginAsAdmin(): void {
  loginMockAdmin();
}

export function logout(): void {
  currentUser = null;
  notify();
}

export function subscribeAuth(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
