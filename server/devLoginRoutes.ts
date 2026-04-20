/**
 * Developer-only login routes. Issues a local-session JWT for a synthetic
 * "Dev User" or "Dev Admin" identity WITHOUT requiring a password. Intended
 * strictly for the sandbox (DTIAPPSINTDEV) so reviewers can click into the
 * app without real credentials.
 *
 * SAFETY
 * ------
 * This module is written so it cannot accidentally be live in production:
 *
 *   1. `assertDevLoginSafeForStartup()` is called once at app boot. If it
 *      detects NODE_ENV=production AND ENABLE_DEV_LOGIN=true WITHOUT an
 *      explicit confirmation env var, it THROWS and the server refuses
 *      to start. Fail loud.
 *
 *   2. `registerDevLoginRoutes()` is a no-op unless ENABLE_DEV_LOGIN=true.
 *      When disabled, the routes simply do not exist and requests to
 *      `/api/auth/dev-login` return 404 like any unknown path.
 *
 *   3. The `/api/auth/dev-login/status` endpoint is always registered,
 *      returns `{ enabled: boolean }`, and the SPA uses it to decide
 *      whether to render the Dev Login page at all. When disabled this
 *      endpoint always returns `{ enabled: false }`.
 *
 *   4. Every successful dev-login writes an audit row so any use is
 *      visible under /admin/#/audit.
 *
 *   5. The dev identities are synthetic - they are NOT inserted into the
 *      `local_users` table - so they cannot be used to sign in via the
 *      normal username/password path, they cannot be the "last admin"
 *      that guards admin deletion, and removing ENABLE_DEV_LOGIN
 *      immediately revokes future sessions (existing JWTs still work
 *      until they expire; use LOCAL_JWT_TTL_SECONDS to shorten that).
 */

import type { FastifyInstance } from "fastify";
import type Database from "better-sqlite3";
import { recordAudit } from "./auditRepo.js";
import {
  localSessionConfigured,
  localSessionTtlSeconds,
  signLocalSession,
} from "./localSessionJwt.js";

const ADMIN_ROLE = "comp-plan-admin";

/** Stable synthetic ids. Kept outside the `local_users` table on purpose. */
const DEV_USER = {
  id: "devlogin-user",
  username: "devuser",
  email: "devuser@dev.local",
  displayName: "Dev User",
  roles: [] as string[],
};

const DEV_ADMIN = {
  id: "devlogin-admin",
  username: "devadmin",
  email: "devadmin@dev.local",
  displayName: "Dev Admin",
  roles: [ADMIN_ROLE],
};

/** True when the env flag is set. Does not by itself guarantee safety;
 *  call `assertDevLoginSafeForStartup()` at boot to enforce that. */
export function isDevLoginEnabled(): boolean {
  return process.env.ENABLE_DEV_LOGIN === "true";
}

/**
 * Throws when dev-login is about to run in a production environment without
 * an explicit opt-in. Called from app bootstrap. Fail loud by design.
 */
export function assertDevLoginSafeForStartup(): void {
  if (!isDevLoginEnabled()) return;
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv !== "production") return;
  const override = process.env.CONFIRM_DEV_LOGIN_IN_PRODUCTION;
  if (override === "yes-i-really-want-this") {
    console.warn(
      "[dev-login] !!! ENABLE_DEV_LOGIN=true with NODE_ENV=production. Proceeding because CONFIRM_DEV_LOGIN_IN_PRODUCTION=yes-i-really-want-this. THIS IS DANGEROUS.",
    );
    return;
  }
  throw new Error(
    "[dev-login] ENABLE_DEV_LOGIN=true is not permitted when NODE_ENV=production. " +
      "Remove ENABLE_DEV_LOGIN from the production .env, OR (only for a sanctioned " +
      "non-prod-labelled-as-prod environment) set CONFIRM_DEV_LOGIN_IN_PRODUCTION=yes-i-really-want-this.",
  );
}

function bodyString(body: unknown, key: string): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const v = (body as Record<string, unknown>)[key];
  return typeof v === "string" ? v : undefined;
}

function clientIp(req: { ip?: string }): string {
  return req.ip || "";
}

/**
 * Always registers `/api/auth/dev-login/status`. Only registers the actual
 * dev-login routes when `ENABLE_DEV_LOGIN=true`. Safe to call unconditionally
 * from app bootstrap.
 */
export function registerDevLoginRoutes(
  app: FastifyInstance,
  db: Database.Database,
): void {
  /** Always-on probe so the SPA can decide whether to render DevLoginPage. */
  app.get("/api/auth/dev-login/status", async () => ({
    enabled: isDevLoginEnabled(),
  }));

  if (!isDevLoginEnabled()) {
    app.log?.info?.("[dev-login] disabled (ENABLE_DEV_LOGIN != 'true') - routes not registered");
    return;
  }

  if (!localSessionConfigured()) {
    app.log?.warn?.(
      "[dev-login] ENABLE_DEV_LOGIN=true but LOCAL_JWT_SECRET is not set. Dev-login cannot issue tokens until a secret is configured.",
    );
  }

  app.log?.warn?.(
    "[dev-login] ENABLED - POST /api/auth/dev-login is live. Do NOT set ENABLE_DEV_LOGIN=true in production.",
  );

  /**
   * POST /api/auth/dev-login
   * body: { role: "user" | "admin" }
   * returns: { accessToken, expiresIn, user }
   */
  app.post(
    "/api/auth/dev-login",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute",
        },
      },
    },
    async (req, reply) => {
      if (!localSessionConfigured()) {
        return reply.code(503).send({
          error:
            "Dev login cannot issue tokens because LOCAL_JWT_SECRET is not configured on the server.",
        });
      }
      const role = (bodyString(req.body, "role") ?? "").trim().toLowerCase();
      if (role !== "user" && role !== "admin") {
        return reply.code(400).send({ error: "role must be 'user' or 'admin'." });
      }
      const identity = role === "admin" ? DEV_ADMIN : DEV_USER;
      const token = await signLocalSession({
        sub: identity.id,
        email: identity.email,
        username: identity.username,
        displayName: identity.displayName,
        roles: identity.roles,
        mustChangePassword: false,
      });
      recordAudit(db, {
        actor: identity.email,
        action: "dev_login_used",
        target: identity.id,
        detail: { role, ip: clientIp(req) },
      });
      return {
        accessToken: token,
        expiresIn: localSessionTtlSeconds(),
        user: {
          id: identity.id,
          username: identity.username,
          email: identity.email,
          displayName: identity.displayName,
          roles: identity.roles,
          mustChangePassword: false,
        },
      };
    },
  );
}
