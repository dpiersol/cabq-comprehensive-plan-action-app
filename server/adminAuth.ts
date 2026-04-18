import type { RequestOwner } from "./authContext.js";

const DEFAULT_ADMIN_ROLES = ["comp-plan-admin", "Application.Admin", "Admin"];

/** Comma-separated **`ADMIN_ROLE_NAMES`** overrides the default Entra app role names. */
export function adminRoleNames(): string[] {
  const raw = process.env.ADMIN_ROLE_NAMES?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return DEFAULT_ADMIN_ROLES;
}

/** Comma-separated **`ADMIN_EMAILS`** grants admin to specific users without Entra app roles (useful pre-Entra). */
export function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** True when the caller holds an admin role OR their email is in `ADMIN_EMAILS`. */
export function isAdmin(owner: RequestOwner): boolean {
  const roleNames = adminRoleNames();
  if (owner.roles.some((r) => roleNames.includes(r))) return true;
  const emails = adminEmails();
  const email = owner.email.trim().toLowerCase();
  if (email && emails.includes(email)) return true;
  return false;
}
