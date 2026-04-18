import type Database from "better-sqlite3";
import { recordAudit } from "./auditRepo.js";
import {
  findByUsernameOrEmail,
  insertUser,
  listUsers,
} from "./localUsersRepo.js";
import { hashPassword } from "./passwords.js";

/**
 * Create a bootstrap admin account on first start if the `local_users` table
 * is empty. Driven by env so we never ship a default password in the repo:
 *   BOOTSTRAP_ADMIN_USERNAME   (default: "admin")
 *   BOOTSTRAP_ADMIN_EMAIL      (required)
 *   BOOTSTRAP_ADMIN_PASSWORD   (required)
 *   BOOTSTRAP_ADMIN_DISPLAY    (default: "Local Administrator")
 *
 * The account is flagged `must_change_password` — the admin is forced to
 * rotate on first login.
 */
export async function bootstrapAdminIfNeeded(db: Database.Database): Promise<void> {
  const existing = listUsers(db);
  if (existing.length > 0) return;

  const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim() || "admin";
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() || "";
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "";
  const displayName = process.env.BOOTSTRAP_ADMIN_DISPLAY?.trim() || "Local Administrator";

  if (!email || !password) {
    console.warn(
      "[bootstrap-admin] No local users and BOOTSTRAP_ADMIN_EMAIL/PASSWORD not set. " +
        "Configure both env vars to auto-create the first admin, or create one via SQL.",
    );
    return;
  }

  if (findByUsernameOrEmail(db, username) || findByUsernameOrEmail(db, email)) {
    return;
  }

  const hash = await hashPassword(password);
  const dto = insertUser(db, {
    username,
    email,
    displayName,
    passwordHash: hash,
    roles: ["comp-plan-admin"],
    mustChangePassword: true,
    actor: "bootstrap",
  });
  recordAudit(db, {
    actor: "bootstrap",
    action: "bootstrap_admin_created",
    target: dto.id,
    detail: { email: dto.email, username: dto.username },
  });
  console.info(
    `[bootstrap-admin] Created initial admin "${username}" <${email}> (must change password on first login).`,
  );
}
