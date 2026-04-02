/**
 * Authentication / authorization placeholder.
 *
 * In production this will be replaced by SSO (SAML / OIDC) integration.
 * For now we expose a simple reactive store so the UI can check `isAdmin`
 * without coupling to a specific provider.
 */

export interface AuthUser {
  displayName: string;
  email: string;
  roles: string[];
}

const ADMIN_ROLE = "comp-plan-admin";

let currentUser: AuthUser | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

export function getAuthUser(): AuthUser | null {
  return currentUser;
}

export function isAdmin(): boolean {
  return currentUser?.roles.includes(ADMIN_ROLE) ?? false;
}

/**
 * Placeholder login — call once to simulate an admin session.
 * Replace with real SSO redirect / token exchange later.
 */
export function loginAsAdmin(): void {
  currentUser = {
    displayName: "Admin User",
    email: "admin@cabq.gov",
    roles: [ADMIN_ROLE],
  };
  notify();
}

export function logout(): void {
  currentUser = null;
  notify();
}

export function subscribeAuth(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
