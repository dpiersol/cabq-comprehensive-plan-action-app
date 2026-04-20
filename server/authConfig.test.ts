import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "./app.js";
import { createMemoryDatabase } from "./db/database.js";
import {
  applyAuthConfigPatch,
  getEffectiveAuthConfig,
} from "./authConfigRepo.js";

const ADMIN_HEADERS = {
  "content-type": "application/json",
  "x-user-email": "seed-admin@cabq.gov",
  "x-user-roles": "comp-plan-admin",
};

describe("auth config precedence", () => {
  const env = { ...process.env };
  beforeEach(() => {
    delete process.env.AZURE_TENANT_ID;
    delete process.env.AZURE_AUDIENCE;
    delete process.env.AZURE_CLIENT_ID;
    delete process.env.ADMIN_ROLE_NAMES;
    delete process.env.ADMIN_EMAILS;
  });
  afterEach(() => {
    for (const k of ["AZURE_TENANT_ID", "AZURE_AUDIENCE", "AZURE_CLIENT_ID", "ADMIN_ROLE_NAMES", "ADMIN_EMAILS"]) {
      if (env[k]) process.env[k] = env[k]!;
      else delete process.env[k];
    }
  });

  it("env provides defaults when DB is empty", () => {
    process.env.AZURE_TENANT_ID = "tenant-env";
    process.env.AZURE_AUDIENCE = "aud-env";
    process.env.ADMIN_ROLE_NAMES = "env-admin";
    process.env.ADMIN_EMAILS = "ENV@cabq.gov";
    const db = createMemoryDatabase();
    const cfg = getEffectiveAuthConfig(db);
    expect(cfg.tenantId).toBe("tenant-env");
    expect(cfg.audience).toBe("aud-env");
    expect(cfg.adminRoleNames).toEqual(["env-admin"]);
    expect(cfg.adminEmails).toEqual(["env@cabq.gov"]);
    expect(cfg.ssoEnabled).toBe(true);
  });

  it("DB overrides env when set", () => {
    process.env.AZURE_TENANT_ID = "tenant-env";
    const db = createMemoryDatabase();
    applyAuthConfigPatch(db, { tenantId: "tenant-db", adminEmails: ["db@x.gov"] }, "tester");
    const cfg = getEffectiveAuthConfig(db);
    expect(cfg.tenantId).toBe("tenant-db");
    expect(cfg.adminEmails).toEqual(["db@x.gov"]);
  });

  it("clearing a DB value falls back to env again", () => {
    process.env.AZURE_TENANT_ID = "tenant-env";
    const db = createMemoryDatabase();
    applyAuthConfigPatch(db, { tenantId: "tenant-db" }, "tester");
    expect(getEffectiveAuthConfig(db).tenantId).toBe("tenant-db");
    applyAuthConfigPatch(db, { tenantId: null }, "tester");
    expect(getEffectiveAuthConfig(db).tenantId).toBe("tenant-env");
  });
});

describe("auth config endpoints", () => {
  it("GET /api/auth/config is public and describes available methods", async () => {
    const db = createMemoryDatabase();
    const app = buildServer({ db });
    const res = await app.inject({ method: "GET", url: "/api/auth/config" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { sso: { enabled: boolean }; local: { enabled: boolean } };
    expect(body.sso.enabled).toBe(false);
    expect(body.local.enabled).toBe(false);
    await app.close();
  });

  it("admin can PATCH and GET effective config", async () => {
    const db = createMemoryDatabase();
    const app = buildServer({ db });
    const patch = await app.inject({
      method: "PATCH",
      url: "/api/admin/auth/config",
      headers: ADMIN_HEADERS,
      payload: {
        ssoEnabled: true,
        tenantId: "my-tenant",
        clientId: "my-client",
        audience: "my-aud",
        allowedEmailDomains: ["cabq.gov", "partner.org"],
        adminEmails: ["boss@cabq.gov"],
      },
    });
    expect(patch.statusCode).toBe(200);
    const cfg = JSON.parse(patch.body) as { sso: { tenantId: string; adminEmails: string[] } };
    expect(cfg.sso.tenantId).toBe("my-tenant");
    expect(cfg.sso.adminEmails).toContain("boss@cabq.gov");

    const pub = await app.inject({ method: "GET", url: "/api/auth/config" });
    const pubBody = JSON.parse(pub.body) as { sso: { enabled: boolean; tenantId: string } };
    expect(pubBody.sso.enabled).toBe(true);
    expect(pubBody.sso.tenantId).toBe("my-tenant");
    await app.close();
  });

  it("non-admin cannot GET or PATCH", async () => {
    const db = createMemoryDatabase();
    const app = buildServer({ db });
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/auth/config",
      headers: { "x-user-email": "nobody@cabq.gov" },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("test-sso returns 400 when no tenant/audience are configured", async () => {
    const db = createMemoryDatabase();
    const app = buildServer({ db });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/auth/test-sso",
      headers: ADMIN_HEADERS,
      payload: { token: "does.not.matter" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
