import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "./app.js";
import { createMemoryDatabase } from "./db/database.js";
import { assertDevLoginSafeForStartup } from "./devLoginRoutes.js";
import { verifyLocalBearer } from "./localSessionJwt.js";

/**
 * Saving/restoring the env vars this suite mutates keeps other test files
 * in the run order clean (they may rely on the defaults).
 */
const SAVED_ENV: Record<string, string | undefined> = {};
const KEYS = [
  "ENABLE_DEV_LOGIN",
  "LOCAL_JWT_SECRET",
  "NODE_ENV",
  "CONFIRM_DEV_LOGIN_IN_PRODUCTION",
];

beforeEach(() => {
  for (const k of KEYS) SAVED_ENV[k] = process.env[k];
});

afterEach(() => {
  for (const k of KEYS) {
    if (SAVED_ENV[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED_ENV[k];
  }
});

describe("dev-login safety gate (assertDevLoginSafeForStartup)", () => {
  it("is a no-op when ENABLE_DEV_LOGIN is unset", () => {
    delete process.env.ENABLE_DEV_LOGIN;
    process.env.NODE_ENV = "production";
    expect(() => assertDevLoginSafeForStartup()).not.toThrow();
  });

  it("is a no-op in non-production environments", () => {
    process.env.ENABLE_DEV_LOGIN = "true";
    process.env.NODE_ENV = "development";
    expect(() => assertDevLoginSafeForStartup()).not.toThrow();
  });

  it("throws when ENABLE_DEV_LOGIN=true under NODE_ENV=production", () => {
    process.env.ENABLE_DEV_LOGIN = "true";
    process.env.NODE_ENV = "production";
    delete process.env.CONFIRM_DEV_LOGIN_IN_PRODUCTION;
    expect(() => assertDevLoginSafeForStartup()).toThrow(
      /not permitted when NODE_ENV=production/,
    );
  });

  it("allows the explicit override for rare environments mislabelled as production", () => {
    process.env.ENABLE_DEV_LOGIN = "true";
    process.env.NODE_ENV = "production";
    process.env.CONFIRM_DEV_LOGIN_IN_PRODUCTION = "yes-i-really-want-this";
    expect(() => assertDevLoginSafeForStartup()).not.toThrow();
  });
});

describe("dev-login status endpoint", () => {
  it("reports enabled=false when ENABLE_DEV_LOGIN is unset", async () => {
    delete process.env.ENABLE_DEV_LOGIN;
    const db = createMemoryDatabase();
    const app = buildServer({ db });
    const res = await app.inject({ method: "GET", url: "/api/auth/dev-login/status" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ enabled: false });
    await app.close();
  });

  it("reports enabled=true when ENABLE_DEV_LOGIN=true", async () => {
    process.env.ENABLE_DEV_LOGIN = "true";
    process.env.LOCAL_JWT_SECRET = "test-secret-that-is-more-than-32-characters-long";
    const db = createMemoryDatabase();
    const app = buildServer({ db });
    const res = await app.inject({ method: "GET", url: "/api/auth/dev-login/status" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ enabled: true });
    await app.close();
  });
});

describe("dev-login POST /api/auth/dev-login", () => {
  it("returns 404 when the feature is disabled", async () => {
    delete process.env.ENABLE_DEV_LOGIN;
    const db = createMemoryDatabase();
    const app = buildServer({ db });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/dev-login",
      payload: { role: "user" },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("issues a local JWT for role=user when enabled", async () => {
    process.env.ENABLE_DEV_LOGIN = "true";
    process.env.LOCAL_JWT_SECRET = "test-secret-that-is-more-than-32-characters-long";
    const db = createMemoryDatabase();
    const app = buildServer({ db });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/dev-login",
      payload: { role: "user" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      accessToken: string;
      user: { roles: string[]; displayName: string };
    };
    expect(body.accessToken).toBeTruthy();
    expect(body.user.displayName).toBe("Dev User");
    expect(body.user.roles).toEqual([]);
    const owner = await verifyLocalBearer(body.accessToken);
    expect(owner).not.toBeNull();
    expect(owner?.ownerKey).toBe("local:devlogin-user");
    expect(owner?.roles).toEqual([]);
    await app.close();
  });

  it("issues a local JWT for role=admin with the comp-plan-admin role", async () => {
    process.env.ENABLE_DEV_LOGIN = "true";
    process.env.LOCAL_JWT_SECRET = "test-secret-that-is-more-than-32-characters-long";
    const db = createMemoryDatabase();
    const app = buildServer({ db });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/dev-login",
      payload: { role: "admin" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      accessToken: string;
      user: { roles: string[]; displayName: string };
    };
    expect(body.user.displayName).toBe("Dev Admin");
    expect(body.user.roles).toContain("comp-plan-admin");
    const owner = await verifyLocalBearer(body.accessToken);
    expect(owner?.ownerKey).toBe("local:devlogin-admin");
    expect(owner?.roles).toContain("comp-plan-admin");
    await app.close();
  });

  it("rejects unknown roles with 400", async () => {
    process.env.ENABLE_DEV_LOGIN = "true";
    process.env.LOCAL_JWT_SECRET = "test-secret-that-is-more-than-32-characters-long";
    const db = createMemoryDatabase();
    const app = buildServer({ db });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/dev-login",
      payload: { role: "superuser" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("returns 503 when ENABLE_DEV_LOGIN=true but LOCAL_JWT_SECRET is missing", async () => {
    process.env.ENABLE_DEV_LOGIN = "true";
    delete process.env.LOCAL_JWT_SECRET;
    const db = createMemoryDatabase();
    const app = buildServer({ db });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/dev-login",
      payload: { role: "user" },
    });
    expect(res.statusCode).toBe(503);
    await app.close();
  });

  it("a dev-admin token passes the admin-gated API", async () => {
    process.env.ENABLE_DEV_LOGIN = "true";
    process.env.LOCAL_JWT_SECRET = "test-secret-that-is-more-than-32-characters-long";
    const db = createMemoryDatabase();
    const app = buildServer({ db });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/dev-login",
      payload: { role: "admin" },
    });
    const token = (login.json() as { accessToken: string }).accessToken;
    const list = await app.inject({
      method: "GET",
      url: "/api/admin/submissions",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.statusCode).toBe(200);
    await app.close();
  });
});
