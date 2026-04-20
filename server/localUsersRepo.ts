import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

export interface LocalUserRow {
  id: string;
  username: string;
  email: string;
  display_name: string;
  password_hash: string;
  is_active: number;
  must_change_password: number;
  last_login_at: string | null;
  failed_attempts: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
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

export function isUserLocked(row: LocalUserRow, nowIso = new Date().toISOString()): boolean {
  if (!row.locked_until) return false;
  return row.locked_until > nowIso;
}

export function rowToDto(row: LocalUserRow, roles: string[]): LocalUserDto {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    isActive: row.is_active !== 0,
    mustChangePassword: row.must_change_password !== 0,
    lastLoginAt: row.last_login_at,
    isLocked: isUserLocked(row),
    failedAttempts: row.failed_attempts,
    lockedUntil: row.locked_until,
    roles,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getRolesForUser(db: Database.Database, userId: string): string[] {
  const rows = db
    .prepare("SELECT role_name FROM user_roles WHERE user_id = ? ORDER BY role_name")
    .all(userId) as { role_name: string }[];
  return rows.map((r) => r.role_name);
}

export function findById(db: Database.Database, id: string): LocalUserRow | null {
  const row = db.prepare("SELECT * FROM local_users WHERE id = ?").get(id) as
    | LocalUserRow
    | undefined;
  return row ?? null;
}

export function findByUsernameOrEmail(
  db: Database.Database,
  raw: string,
): LocalUserRow | null {
  const token = raw.trim().toLowerCase();
  if (!token) return null;
  const row = db
    .prepare(
      "SELECT * FROM local_users WHERE lower(username) = ? OR lower(email) = ? LIMIT 1",
    )
    .get(token, token) as LocalUserRow | undefined;
  return row ?? null;
}

export function findByEmail(db: Database.Database, email: string): LocalUserRow | null {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  const row = db.prepare("SELECT * FROM local_users WHERE lower(email) = ?").get(e) as
    | LocalUserRow
    | undefined;
  return row ?? null;
}

export function listUsers(db: Database.Database): LocalUserDto[] {
  const rows = db
    .prepare("SELECT * FROM local_users ORDER BY lower(username)")
    .all() as LocalUserRow[];
  return rows.map((r) => rowToDto(r, getRolesForUser(db, r.id)));
}

export function getUser(db: Database.Database, id: string): LocalUserDto | null {
  const row = findById(db, id);
  if (!row) return null;
  return rowToDto(row, getRolesForUser(db, row.id));
}

export interface CreateUserInput {
  username: string;
  email: string;
  displayName: string;
  passwordHash: string;
  roles: string[];
  mustChangePassword?: boolean;
  actor?: string;
}

export function insertUser(db: Database.Database, input: CreateUserInput): LocalUserDto {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO local_users (
       id, username, email, display_name, password_hash,
       is_active, must_change_password, last_login_at,
       failed_attempts, locked_until, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, 1, ?, NULL, 0, NULL, ?, ?)`,
  ).run(
    id,
    input.username.trim(),
    input.email.trim().toLowerCase(),
    input.displayName.trim(),
    input.passwordHash,
    input.mustChangePassword ? 1 : 0,
    now,
    now,
  );
  replaceRoles(db, id, input.roles, input.actor);
  const row = findById(db, id);
  if (!row) throw new Error("Failed to read back new user");
  return rowToDto(row, getRolesForUser(db, id));
}

export interface UpdateUserInput {
  displayName?: string;
  email?: string;
  isActive?: boolean;
  mustChangePassword?: boolean;
}

export function updateUser(
  db: Database.Database,
  id: string,
  patch: UpdateUserInput,
): LocalUserDto | null {
  const existing = findById(db, id);
  if (!existing) return null;
  const displayName = patch.displayName?.trim() ?? existing.display_name;
  const email = patch.email?.trim().toLowerCase() ?? existing.email;
  const isActive = patch.isActive === undefined ? existing.is_active : patch.isActive ? 1 : 0;
  const mustChange =
    patch.mustChangePassword === undefined
      ? existing.must_change_password
      : patch.mustChangePassword
        ? 1
        : 0;
  db.prepare(
    `UPDATE local_users
        SET display_name = ?, email = ?, is_active = ?, must_change_password = ?, updated_at = ?
        WHERE id = ?`,
  ).run(displayName, email, isActive, mustChange, new Date().toISOString(), id);
  return getUser(db, id);
}

export function deleteUser(db: Database.Database, id: string): boolean {
  const res = db.prepare("DELETE FROM local_users WHERE id = ?").run(id);
  return res.changes > 0;
}

export function setPassword(
  db: Database.Database,
  id: string,
  passwordHash: string,
  opts: { mustChangePassword?: boolean } = {},
): boolean {
  const must = opts.mustChangePassword ? 1 : 0;
  const res = db
    .prepare(
      `UPDATE local_users
         SET password_hash = ?, must_change_password = ?, failed_attempts = 0,
             locked_until = NULL, updated_at = ?
         WHERE id = ?`,
    )
    .run(passwordHash, must, new Date().toISOString(), id);
  return res.changes > 0;
}

export function replaceRoles(
  db: Database.Database,
  userId: string,
  roles: string[],
  actor: string | undefined,
): void {
  const now = new Date().toISOString();
  const tx = db.transaction((names: string[]) => {
    db.prepare("DELETE FROM user_roles WHERE user_id = ?").run(userId);
    const ins = db.prepare(
      "INSERT INTO user_roles (user_id, role_name, assigned_by, assigned_at) VALUES (?, ?, ?, ?)",
    );
    for (const r of names) ins.run(userId, r, actor ?? null, now);
  });
  tx(Array.from(new Set(roles.filter(Boolean))));
}

export function addRole(
  db: Database.Database,
  userId: string,
  roleName: string,
  actor: string | undefined,
): void {
  db.prepare(
    `INSERT OR IGNORE INTO user_roles (user_id, role_name, assigned_by, assigned_at)
     VALUES (?, ?, ?, ?)`,
  ).run(userId, roleName, actor ?? null, new Date().toISOString());
}

export function removeRole(db: Database.Database, userId: string, roleName: string): void {
  db.prepare("DELETE FROM user_roles WHERE user_id = ? AND role_name = ?").run(
    userId,
    roleName,
  );
}

export function countAdmins(db: Database.Database, roleName: string): number {
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT u.id) AS n
         FROM local_users u
         JOIN user_roles ur ON ur.user_id = u.id
         WHERE ur.role_name = ? AND u.is_active = 1`,
    )
    .get(roleName) as { n: number };
  return row.n;
}

export function isLastAdmin(
  db: Database.Database,
  userId: string,
  roleName: string,
): boolean {
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT u.id) AS n
         FROM local_users u
         JOIN user_roles ur ON ur.user_id = u.id
         WHERE ur.role_name = ? AND u.is_active = 1 AND u.id != ?`,
    )
    .get(roleName, userId) as { n: number };
  return row.n === 0;
}

export function listRoles(
  db: Database.Database,
): { name: string; description: string | null; isBuiltin: boolean; memberCount: number }[] {
  const rows = db
    .prepare(
      `SELECT r.name, r.description, r.is_builtin AS isBuiltin,
              (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_name = r.name) AS memberCount
         FROM roles r
         ORDER BY r.name`,
    )
    .all() as {
    name: string;
    description: string | null;
    isBuiltin: number;
    memberCount: number;
  }[];
  return rows.map((r) => ({
    name: r.name,
    description: r.description,
    isBuiltin: r.isBuiltin !== 0,
    memberCount: r.memberCount,
  }));
}

export function createRole(
  db: Database.Database,
  name: string,
  description: string | null,
): boolean {
  try {
    db.prepare(
      "INSERT INTO roles (name, description, is_builtin) VALUES (?, ?, 0)",
    ).run(name, description);
    return true;
  } catch {
    return false;
  }
}

export function deleteRole(db: Database.Database, name: string): "ok" | "builtin" | "not_found" {
  const r = db.prepare("SELECT is_builtin FROM roles WHERE name = ?").get(name) as
    | { is_builtin: number }
    | undefined;
  if (!r) return "not_found";
  if (r.is_builtin) return "builtin";
  db.prepare("DELETE FROM roles WHERE name = ?").run(name);
  return "ok";
}

export interface LoginResult {
  ok: boolean;
  reason?: "unknown" | "inactive" | "locked" | "bad_password";
  user?: LocalUserRow;
  roles?: string[];
}

const DEFAULT_MAX_FAILS = 5;
const DEFAULT_LOCK_MINUTES = 15;

function maxFails(): number {
  const raw = process.env.LOCAL_LOGIN_MAX_FAILS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 20) return n;
  }
  return DEFAULT_MAX_FAILS;
}

function lockMinutes(): number {
  const raw = process.env.LOCAL_LOGIN_LOCK_MINUTES?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 24 * 60) return n;
  }
  return DEFAULT_LOCK_MINUTES;
}

export function registerFailedLogin(db: Database.Database, userId: string): void {
  const now = new Date();
  const row = findById(db, userId);
  if (!row) return;
  const nextFails = row.failed_attempts + 1;
  let lockedUntil: string | null = row.locked_until;
  if (nextFails >= maxFails()) {
    lockedUntil = new Date(now.getTime() + lockMinutes() * 60_000).toISOString();
  }
  db.prepare(
    "UPDATE local_users SET failed_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?",
  ).run(nextFails, lockedUntil, now.toISOString(), userId);
}

export function registerSuccessfulLogin(db: Database.Database, userId: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE local_users
        SET failed_attempts = 0, locked_until = NULL, last_login_at = ?, updated_at = ?
        WHERE id = ?`,
  ).run(now, now, userId);
}

export function getRolesForUserPublic(db: Database.Database, userId: string): string[] {
  return getRolesForUser(db, userId);
}
