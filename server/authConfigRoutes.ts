import type Database from "better-sqlite3";
import type { FastifyInstance } from "fastify";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { isAdminFor } from "./adminAuth.js";
import { recordAudit } from "./auditRepo.js";
import { resolveOwner } from "./authContext.js";
import {
  applyAuthConfigPatch,
  getEffectiveAuthConfig,
  type AuthConfigPatch,
} from "./authConfigRepo.js";
import { localSessionConfigured } from "./localSessionJwt.js";

function bool(body: unknown, key: string): boolean | undefined {
  if (!body || typeof body !== "object") return undefined;
  const v = (body as Record<string, unknown>)[key];
  return typeof v === "boolean" ? v : undefined;
}
function str(body: unknown, key: string): string | null | undefined {
  if (!body || typeof body !== "object") return undefined;
  const v = (body as Record<string, unknown>)[key];
  if (v === null) return null;
  return typeof v === "string" ? v : undefined;
}
function strList(body: unknown, key: string): string[] | undefined {
  if (!body || typeof body !== "object") return undefined;
  const v = (body as Record<string, unknown>)[key];
  if (!Array.isArray(v)) return undefined;
  return v.filter((x): x is string => typeof x === "string");
}

function publicView(cfg: ReturnType<typeof getEffectiveAuthConfig>) {
  // Everything here is safe to expose to unauth clients — helps the login UI
  // decide whether to show the SSO tab, which client id to use, etc.
  return {
    sso: {
      enabled: cfg.ssoEnabled && Boolean(cfg.tenantId && cfg.clientId),
      tenantId: cfg.tenantId,
      clientId: cfg.clientId,
      authority: cfg.tenantId
        ? `https://login.microsoftonline.com/${cfg.tenantId}`
        : null,
      allowedEmailDomains: cfg.allowedEmailDomains,
    },
    local: {
      enabled: cfg.localEnabled && localSessionConfigured(),
    },
  };
}

function adminView(cfg: ReturnType<typeof getEffectiveAuthConfig>) {
  return {
    sso: {
      enabled: cfg.ssoEnabled,
      tenantId: cfg.tenantId,
      clientId: cfg.clientId,
      audience: cfg.audience,
      issuer: cfg.issuer,
      allowedEmailDomains: cfg.allowedEmailDomains,
      adminRoleNames: cfg.adminRoleNames,
      adminEmails: cfg.adminEmails,
    },
    local: {
      enabled: cfg.localEnabled,
      configured: localSessionConfigured(),
    },
  };
}

export function registerAuthConfigRoutes(app: FastifyInstance, db: Database.Database): void {
  /** Public — what sign-in options are available on this server? */
  app.get("/api/auth/config", async () => publicView(getEffectiveAuthConfig(db)));

  /** Admin — read the full (non-sensitive) effective config. */
  app.get("/api/admin/auth/config", async (req, reply) => {
    const owner = await resolveOwner(req, db);
    if (!owner) return reply.code(401).send({ error: "Authentication required" });
    if (!isAdminFor(db, owner)) return reply.code(403).send({ error: "Admin role required" });
    return adminView(getEffectiveAuthConfig(db));
  });

  /** Admin — patch the config. Only supplied keys are updated. */
  app.patch("/api/admin/auth/config", async (req, reply) => {
    const owner = await resolveOwner(req, db);
    if (!owner) return reply.code(401).send({ error: "Authentication required" });
    if (!isAdminFor(db, owner)) return reply.code(403).send({ error: "Admin role required" });
    const patch: AuthConfigPatch = {};
    const sso = bool(req.body, "ssoEnabled");
    if (sso !== undefined) patch.ssoEnabled = sso;
    const local = bool(req.body, "localEnabled");
    if (local !== undefined) patch.localEnabled = local;
    for (const k of ["tenantId", "clientId", "audience", "issuer"] as const) {
      const v = str(req.body, k);
      if (v !== undefined) patch[k] = v === "" ? null : v;
    }
    for (const k of ["allowedEmailDomains", "adminRoleNames", "adminEmails"] as const) {
      const v = strList(req.body, k);
      if (v !== undefined) patch[k] = v;
    }
    const result = applyAuthConfigPatch(db, patch, owner.email);
    recordAudit(db, {
      actor: owner.email,
      action: "admin_auth_config_update",
      detail: { keys: Object.keys(patch) },
    });
    return adminView(result);
  });

  /** Admin — dry-run an Entra token against the current (or supplied) tenant/audience/issuer. */
  app.post("/api/admin/auth/test-sso", async (req, reply) => {
    const owner = await resolveOwner(req, db);
    if (!owner) return reply.code(401).send({ error: "Authentication required" });
    if (!isAdminFor(db, owner)) return reply.code(403).send({ error: "Admin role required" });
    const body = (req.body ?? {}) as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token : "";
    if (!token) return reply.code(400).send({ error: "token is required" });
    const cfg = getEffectiveAuthConfig(db);
    const tenantId =
      typeof body.tenantId === "string" && body.tenantId.trim()
        ? body.tenantId.trim()
        : cfg.tenantId;
    const audience =
      typeof body.audience === "string" && body.audience.trim()
        ? body.audience.trim()
        : cfg.audience;
    const issuer =
      typeof body.issuer === "string" && body.issuer.trim()
        ? body.issuer.trim()
        : cfg.issuer ?? (tenantId ? `https://login.microsoftonline.com/${tenantId}/v2.0` : null);
    if (!tenantId || !audience || !issuer) {
      return reply.code(400).send({
        error: "tenantId, audience, and issuer must be set (either in config or request body).",
      });
    }
    const audiences = audience.split(",").map((s) => s.trim()).filter(Boolean);
    try {
      const JWKS = createRemoteJWKSet(
        new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`),
      );
      const { payload } = await jwtVerify(token, JWKS, {
        issuer,
        audience: audiences.length === 1 ? audiences[0] : audiences,
      });
      recordAudit(db, {
        actor: owner.email,
        action: "admin_auth_config_test_sso_success",
        detail: { tenantId, audience, issuer },
      });
      return {
        ok: true,
        payload: {
          oid: payload.oid ?? null,
          email:
            (typeof payload.preferred_username === "string" && payload.preferred_username) ||
            (typeof payload.email === "string" && payload.email) ||
            (typeof payload.upn === "string" && payload.upn) ||
            null,
          roles: Array.isArray(payload.roles)
            ? payload.roles.filter((r): r is string => typeof r === "string")
            : [],
          iss: payload.iss,
          aud: payload.aud,
          exp: payload.exp,
        },
      };
    } catch (err) {
      recordAudit(db, {
        actor: owner.email,
        action: "admin_auth_config_test_sso_failed",
        detail: {
          tenantId,
          audience,
          issuer,
          error: err instanceof Error ? err.message : String(err),
        },
      });
      return reply.code(400).send({
        ok: false,
        error: err instanceof Error ? err.message : "token verification failed",
      });
    }
  });
}
