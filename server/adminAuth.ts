import type Database from "better-sqlite3";
import type { RequestOwner } from "./authContext.js";
import { getEffectiveAuthConfig } from "./authConfigRepo.js";

/** Comma-separated **`ADMIN_ROLE_NAMES`** overrides the default Entra app role names.
 * Kept as a helper for legacy callers; prefer reading from effective config via `isAdminFor()`. */
export function adminRoleNames(): string[] {
  const raw = process.env.ADMIN_ROLE_NAMES?.trim();
  if (raw) return raw.split(",").map((s) => s.trim()).filter(Boolean);
  return ["comp-plan-admin", "Application.Admin", "Admin"];
}

/** Comma-separated **`ADMIN_EMAILS`** grants admin to specific users without Entra app roles. */
export function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS?.trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/** Env-only version (legacy; used where no DB handle is available, e.g. early bootstrap). */
export function isAdmin(owner: RequestOwner): boolean {
  const roleNames = adminRoleNames();
  if (owner.roles.some((r) => roleNames.includes(r))) return true;
  const emails = adminEmails();
  const email = owner.email.trim().toLowerCase();
  if (email && emails.includes(email)) return true;
  return false;
}

/** DB-aware admin check. Reads the effective auth config so DB overrides kick in. */
export function isAdminFor(db: Database.Database, owner: RequestOwner): boolean {
  const cfg = getEffectiveAuthConfig(db);
  if (owner.roles.some((r) => cfg.adminRoleNames.includes(r))) return true;
  const email = owner.email.trim().toLowerCase();
  if (email && cfg.adminEmails.includes(email)) return true;
  return false;
}
