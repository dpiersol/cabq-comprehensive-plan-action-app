import type { FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import { isAdminFor } from "./adminAuth.js";
import { resolveOwner } from "./authContext.js";
import { listAudit, recordAudit } from "./auditRepo.js";
import {
  addRole,
  countAdmins,
  createRole,
  deleteRole,
  deleteUser,
  findByUsernameOrEmail,
  getRolesForUserPublic,
  getUser,
  insertUser,
  isLastAdmin,
  listRoles,
  listUsers,
  registerFailedLogin,
  registerSuccessfulLogin,
  removeRole,
  replaceRoles,
  setPassword,
  updateUser,
} from "./localUsersRepo.js";
import {
  localSessionConfigured,
  localSessionTtlSeconds,
  signLocalSession,
} from "./localSessionJwt.js";
import { hashPassword, validatePasswordPolicy, verifyPassword } from "./passwords.js";

const ADMIN_ROLE = "comp-plan-admin";

function clientIp(req: { ip?: string; headers: Record<string, unknown> }): string {
  return req.ip || "";
}

function bodyString(body: unknown, key: string): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const v = (body as Record<string, unknown>)[key];
  return typeof v === "string" ? v : undefined;
}

function bodyBool(body: unknown, key: string): boolean | undefined {
  if (!body || typeof body !== "object") return undefined;
  const v = (body as Record<string, unknown>)[key];
  return typeof v === "boolean" ? v : undefined;
}

function bodyStringArray(body: unknown, key: string): string[] | undefined {
  if (!body || typeof body !== "object") return undefined;
  const v = (body as Record<string, unknown>)[key];
  if (!Array.isArray(v)) return undefined;
  return v.filter((x): x is string => typeof x === "string");
}

export function registerLocalAuthRoutes(app: FastifyInstance, db: Database.Database): void {
  /** POST /api/auth/local/login — username/email + password */
  app.post(
    "/api/auth/local/login",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
    },
    async (req, reply) => {
    if (!localSessionConfigured()) {
      return reply.code(503).send({
        error: "Local sign-in is not configured on the server (missing LOCAL_JWT_SECRET).",
      });
    }
    const identifier = (bodyString(req.body, "identifier") ?? "").trim();
    const password = bodyString(req.body, "password") ?? "";
    if (!identifier || !password) {
      return reply.code(400).send({ error: "Username/email and password are required." });
    }
    const user = findByUsernameOrEmail(db, identifier);
    if (!user || !user.is_active) {
      recordAudit(db, {
        actor: identifier,
        action: "local_login_failed",
        target: null,
        detail: { reason: "unknown_or_inactive", ip: clientIp(req) },
      });
      return reply.code(401).send({ error: "Invalid credentials." });
    }
    if (user.locked_until && user.locked_until > new Date().toISOString()) {
      recordAudit(db, {
        actor: user.email,
        action: "local_login_failed",
        target: user.id,
        detail: { reason: "locked", ip: clientIp(req) },
      });
      return reply
        .code(423)
        .send({ error: "Account is temporarily locked. Try again later." });
    }
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      registerFailedLogin(db, user.id);
      recordAudit(db, {
        actor: user.email,
        action: "local_login_failed",
        target: user.id,
        detail: { reason: "bad_password", ip: clientIp(req) },
      });
      return reply.code(401).send({ error: "Invalid credentials." });
    }
    registerSuccessfulLogin(db, user.id);
    const roles = getRolesForUserPublic(db, user.id);
    const token = await signLocalSession({
      sub: user.id,
      email: user.email,
      username: user.username,
      displayName: user.display_name,
      roles,
      mustChangePassword: user.must_change_password !== 0,
    });
    recordAudit(db, {
      actor: user.email,
      action: "local_login_success",
      target: user.id,
      detail: { ip: clientIp(req) },
    });
    return {
      accessToken: token,
      expiresIn: localSessionTtlSeconds(),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        roles,
        mustChangePassword: user.must_change_password !== 0,
      },
    };
    },
  );

  /** POST /api/auth/local/change-password — caller changes own password */
  app.post("/api/auth/local/change-password", async (req, reply) => {
    const owner = await resolveOwner(req, db);
    if (!owner || owner.source !== "local" || !owner.ownerKey.startsWith("local:")) {
      return reply.code(401).send({ error: "Local authentication required." });
    }
    const userId = owner.ownerKey.slice("local:".length);
    const user = getUser(db, userId);
    if (!user) return reply.code(404).send({ error: "User not found." });
    const current = bodyString(req.body, "currentPassword") ?? "";
    const next = bodyString(req.body, "newPassword") ?? "";
    if (!current || !next) {
      return reply.code(400).send({ error: "Both currentPassword and newPassword are required." });
    }
    const row = findByUsernameOrEmail(db, user.username);
    if (!row) return reply.code(404).send({ error: "User not found." });
    const ok = await verifyPassword(current, row.password_hash);
    if (!ok) {
      recordAudit(db, {
        actor: owner.email,
        action: "local_change_password_failed",
        target: userId,
        detail: { reason: "bad_current", ip: clientIp(req) },
      });
      return reply.code(401).send({ error: "Current password is incorrect." });
    }
    const errors = validatePasswordPolicy(next, {
      username: user.username,
      email: user.email,
      displayName: user.displayName,
    });
    if (errors.length) return reply.code(400).send({ error: errors.join(" ") });
    const hash = await hashPassword(next);
    setPassword(db, userId, hash, { mustChangePassword: false });
    recordAudit(db, {
      actor: owner.email,
      action: "local_change_password_success",
      target: userId,
      detail: { ip: clientIp(req) },
    });
    return { ok: true };
  });

  /** --- Admin: users --- */
  app.get("/api/admin/users", async (req, reply) => {
    const owner = await resolveOwner(req, db);
    if (!owner) return reply.code(401).send({ error: "Authentication required" });
    if (!isAdminFor(db, owner)) return reply.code(403).send({ error: "Admin role required" });
    return listUsers(db);
  });

  app.post("/api/admin/users", async (req, reply) => {
    const owner = await resolveOwner(req, db);
    if (!owner) return reply.code(401).send({ error: "Authentication required" });
    if (!isAdminFor(db, owner)) return reply.code(403).send({ error: "Admin role required" });
    const username = (bodyString(req.body, "username") ?? "").trim();
    const email = (bodyString(req.body, "email") ?? "").trim().toLowerCase();
    const displayName = (bodyString(req.body, "displayName") ?? "").trim();
    const password = bodyString(req.body, "password") ?? "";
    const roles = bodyStringArray(req.body, "roles") ?? [];
    const mustChange = bodyBool(req.body, "mustChangePassword") ?? true;
    if (!username || !email || !displayName) {
      return reply.code(400).send({ error: "username, email, and displayName are required." });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return reply.code(400).send({ error: "Email is not a valid address." });
    }
    const pwErrors = validatePasswordPolicy(password, { username, email, displayName });
    if (pwErrors.length) return reply.code(400).send({ error: pwErrors.join(" ") });
    if (findByUsernameOrEmail(db, username) || findByUsernameOrEmail(db, email)) {
      return reply.code(409).send({ error: "Username or email already exists." });
    }
    const hash = await hashPassword(password);
    const dto = insertUser(db, {
      username,
      email,
      displayName,
      passwordHash: hash,
      roles,
      mustChangePassword: mustChange,
      actor: owner.email,
    });
    recordAudit(db, {
      actor: owner.email,
      action: "admin_user_create",
      target: dto.id,
      detail: { email: dto.email, roles: dto.roles },
    });
    return reply.code(201).send(dto);
  });

  app.get<{ Params: { id: string } }>("/api/admin/users/:id", async (req, reply) => {
    const owner = await resolveOwner(req, db);
    if (!owner) return reply.code(401).send({ error: "Authentication required" });
    if (!isAdminFor(db, owner)) return reply.code(403).send({ error: "Admin role required" });
    const dto = getUser(db, req.params.id);
    if (!dto) return reply.code(404).send({ error: "Not found" });
    return dto;
  });

  app.patch<{ Params: { id: string } }>("/api/admin/users/:id", async (req, reply) => {
    const owner = await resolveOwner(req, db);
    if (!owner) return reply.code(401).send({ error: "Authentication required" });
    if (!isAdminFor(db, owner)) return reply.code(403).send({ error: "Admin role required" });
    const existing = getUser(db, req.params.id);
    if (!existing) return reply.code(404).send({ error: "Not found" });

    const displayName = bodyString(req.body, "displayName");
    const email = bodyString(req.body, "email");
    const isActive = bodyBool(req.body, "isActive");
    const mustChangePassword = bodyBool(req.body, "mustChangePassword");
    const roles = bodyStringArray(req.body, "roles");

    if (email !== undefined && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      return reply.code(400).send({ error: "Email is not a valid address." });
    }

    const willRemoveAdmin =
      (roles !== undefined && existing.roles.includes(ADMIN_ROLE) && !roles.includes(ADMIN_ROLE)) ||
      (isActive === false && existing.roles.includes(ADMIN_ROLE));
    if (willRemoveAdmin && isLastAdmin(db, existing.id, ADMIN_ROLE)) {
      return reply
        .code(409)
        .send({ error: "Cannot remove the last active admin. Promote another user first." });
    }

    const dto = updateUser(db, req.params.id, {
      displayName,
      email,
      isActive,
      mustChangePassword,
    });
    if (!dto) return reply.code(404).send({ error: "Not found" });
    if (roles !== undefined) {
      replaceRoles(db, req.params.id, roles, owner.email);
    }
    const fresh = getUser(db, req.params.id);
    recordAudit(db, {
      actor: owner.email,
      action: "admin_user_update",
      target: req.params.id,
      detail: { patch: { displayName, email, isActive, mustChangePassword, roles } },
    });
    return fresh;
  });

  app.delete<{ Params: { id: string } }>("/api/admin/users/:id", async (req, reply) => {
    const owner = await resolveOwner(req, db);
    if (!owner) return reply.code(401).send({ error: "Authentication required" });
    if (!isAdminFor(db, owner)) return reply.code(403).send({ error: "Admin role required" });
    const existing = getUser(db, req.params.id);
    if (!existing) return reply.code(404).send({ error: "Not found" });
    if (existing.roles.includes(ADMIN_ROLE) && isLastAdmin(db, existing.id, ADMIN_ROLE)) {
      return reply
        .code(409)
        .send({ error: "Cannot delete the last active admin. Promote another user first." });
    }
    deleteUser(db, req.params.id);
    recordAudit(db, {
      actor: owner.email,
      action: "admin_user_delete",
      target: req.params.id,
      detail: { email: existing.email },
    });
    return { ok: true };
  });

  /** POST /api/admin/users/:id/reset-password — admin resets, forces user change on next login */
  app.post<{ Params: { id: string } }>(
    "/api/admin/users/:id/reset-password",
    async (req, reply) => {
      const owner = await resolveOwner(req, db);
      if (!owner) return reply.code(401).send({ error: "Authentication required" });
      if (!isAdminFor(db, owner)) return reply.code(403).send({ error: "Admin role required" });
      const existing = getUser(db, req.params.id);
      if (!existing) return reply.code(404).send({ error: "Not found" });
      const password = bodyString(req.body, "password") ?? "";
      const errors = validatePasswordPolicy(password, {
        username: existing.username,
        email: existing.email,
        displayName: existing.displayName,
      });
      if (errors.length) return reply.code(400).send({ error: errors.join(" ") });
      const hash = await hashPassword(password);
      setPassword(db, req.params.id, hash, { mustChangePassword: true });
      recordAudit(db, {
        actor: owner.email,
        action: "admin_user_reset_password",
        target: req.params.id,
        detail: { email: existing.email },
      });
      return { ok: true };
    },
  );

  /** --- Admin: roles --- */
  app.get("/api/admin/roles", async (req, reply) => {
    const owner = await resolveOwner(req, db);
    if (!owner) return reply.code(401).send({ error: "Authentication required" });
    if (!isAdminFor(db, owner)) return reply.code(403).send({ error: "Admin role required" });
    return {
      roles: listRoles(db),
      adminCount: countAdmins(db, ADMIN_ROLE),
    };
  });

  app.post("/api/admin/roles", async (req, reply) => {
    const owner = await resolveOwner(req, db);
    if (!owner) return reply.code(401).send({ error: "Authentication required" });
    if (!isAdminFor(db, owner)) return reply.code(403).send({ error: "Admin role required" });
    const name = (bodyString(req.body, "name") ?? "").trim();
    const description = bodyString(req.body, "description")?.trim() ?? null;
    if (!/^[A-Za-z0-9_.\-]{2,64}$/.test(name)) {
      return reply
        .code(400)
        .send({ error: "Role name must be 2–64 chars: letters, digits, _, ., -." });
    }
    const ok = createRole(db, name, description);
    if (!ok) return reply.code(409).send({ error: "Role already exists." });
    recordAudit(db, {
      actor: owner.email,
      action: "admin_role_create",
      target: name,
    });
    return reply.code(201).send({ ok: true });
  });

  app.delete<{ Params: { name: string } }>("/api/admin/roles/:name", async (req, reply) => {
    const owner = await resolveOwner(req, db);
    if (!owner) return reply.code(401).send({ error: "Authentication required" });
    if (!isAdminFor(db, owner)) return reply.code(403).send({ error: "Admin role required" });
    const result = deleteRole(db, req.params.name);
    if (result === "not_found") return reply.code(404).send({ error: "Not found" });
    if (result === "builtin") {
      return reply.code(409).send({ error: "Built-in roles cannot be deleted." });
    }
    recordAudit(db, {
      actor: owner.email,
      action: "admin_role_delete",
      target: req.params.name,
    });
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>(
    "/api/admin/users/:id/roles",
    async (req, reply) => {
      const owner = await resolveOwner(req, db);
      if (!owner) return reply.code(401).send({ error: "Authentication required" });
      if (!isAdminFor(db, owner)) return reply.code(403).send({ error: "Admin role required" });
      const name = (bodyString(req.body, "name") ?? "").trim();
      if (!name) return reply.code(400).send({ error: "Role name required" });
      const user = getUser(db, req.params.id);
      if (!user) return reply.code(404).send({ error: "Not found" });
      addRole(db, req.params.id, name, owner.email);
      recordAudit(db, {
        actor: owner.email,
        action: "admin_user_role_add",
        target: req.params.id,
        detail: { role: name },
      });
      return getUser(db, req.params.id);
    },
  );

  app.delete<{ Params: { id: string; name: string } }>(
    "/api/admin/users/:id/roles/:name",
    async (req, reply) => {
      const owner = await resolveOwner(req, db);
      if (!owner) return reply.code(401).send({ error: "Authentication required" });
      if (!isAdminFor(db, owner)) return reply.code(403).send({ error: "Admin role required" });
      const user = getUser(db, req.params.id);
      if (!user) return reply.code(404).send({ error: "Not found" });
      if (
        req.params.name === ADMIN_ROLE &&
        user.roles.includes(ADMIN_ROLE) &&
        isLastAdmin(db, req.params.id, ADMIN_ROLE)
      ) {
        return reply
          .code(409)
          .send({ error: "Cannot remove the last active admin role assignment." });
      }
      removeRole(db, req.params.id, req.params.name);
      recordAudit(db, {
        actor: owner.email,
        action: "admin_user_role_remove",
        target: req.params.id,
        detail: { role: req.params.name },
      });
      return getUser(db, req.params.id);
    },
  );

  /** --- Admin: audit log --- */
  app.get("/api/admin/auth/audit", async (req, reply) => {
    const owner = await resolveOwner(req, db);
    if (!owner) return reply.code(401).send({ error: "Authentication required" });
    if (!isAdminFor(db, owner)) return reply.code(403).send({ error: "Admin role required" });
    const q = req.query as Record<string, string | undefined> | undefined;
    const limit = q?.limit ? Number.parseInt(q.limit, 10) : undefined;
    const beforeId = q?.beforeId ? Number.parseInt(q.beforeId, 10) : undefined;
    const action = q?.action;
    return listAudit(db, { limit, beforeId, action });
  });
}
