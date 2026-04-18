import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "./app.js";
import { createMemoryDatabase } from "./db/database.js";
import { hashPassword, validatePasswordPolicy, verifyPassword } from "./passwords.js";

const LOCAL_SECRET = "x".repeat(48);

async function buildWithLocal() {
  const db = createMemoryDatabase();
  const app = buildServer({ db });
  return { db, app };
}

async function createAdmin(
  app: Awaited<ReturnType<typeof buildServer>>,
  payload: Record<string, unknown>,
) {
  return app.inject({
    method: "POST",
    url: "/api/admin/users",
    headers: {
      "content-type": "application/json",
      "x-user-email": "seed-admin@cabq.gov",
      "x-user-roles": "comp-plan-admin",
    },
    payload,
  });
}

describe("password policy", () => {
  it("rejects short / low-entropy / doppelganger passwords", () => {
    expect(validatePasswordPolicy("short1!A")).toContain(
      "Password must be at least 12 characters long.",
    );
    expect(validatePasswordPolicy("abcdefghijkl")).toContain(
      "Password must include at least 3 of: lowercase, uppercase, digit, symbol.",
    );
    expect(
      validatePasswordPolicy("JaneDoe123!xYZ", { username: "janedoe", email: "jane@x.gov" }),
    ).toContain("Password cannot contain your username, email, or name.");
  });

  it("accepts a strong password", () => {
    expect(validatePasswordPolicy("VerySecret!Pass9a")).toEqual([]);
  });

  it("hashes and verifies", async () => {
    const hash = await hashPassword("VerySecret!Pass9a");
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(await verifyPassword("VerySecret!Pass9a", hash)).toBe(true);
    expect(await verifyPassword("nope", hash)).toBe(false);
  });
});

describe("local auth routes", () => {
  const prevSecret = process.env.LOCAL_JWT_SECRET;
  beforeEach(() => {
    process.env.LOCAL_JWT_SECRET = LOCAL_SECRET;
  });
  afterEach(() => {
    if (prevSecret === undefined) delete process.env.LOCAL_JWT_SECRET;
    else process.env.LOCAL_JWT_SECRET = prevSecret;
  });

  it("login fails when server has no LOCAL_JWT_SECRET", async () => {
    delete process.env.LOCAL_JWT_SECRET;
    const { app } = await buildWithLocal();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/local/login",
      headers: { "content-type": "application/json" },
      payload: { identifier: "anyone", password: "any" },
    });
    expect(res.statusCode).toBe(503);
    await app.close();
  });

  it("admin can create a user; user can log in; token grants submission access", async () => {
    const { app } = await buildWithLocal();
    const created = await createAdmin(app, {
      username: "ops",
      email: "ops@cabq.gov",
      displayName: "Ops User",
      password: "OpsPass!Word123",
      roles: ["comp-plan-user"],
      mustChangePassword: false,
    });
    expect(created.statusCode).toBe(201);

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/local/login",
      headers: { "content-type": "application/json" },
      payload: { identifier: "ops@cabq.gov", password: "OpsPass!Word123" },
    });
    expect(login.statusCode).toBe(200);
    const { accessToken } = JSON.parse(login.body) as { accessToken: string };
    expect(accessToken).toBeTruthy();

    const listRes = await app.inject({
      method: "GET",
      url: "/api/submissions",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(JSON.parse(listRes.body)).toEqual([]);
    await app.close();
  });

  it("bad password increments failed attempts and eventually locks the account", async () => {
    process.env.LOCAL_LOGIN_MAX_FAILS = "3";
    const { app } = await buildWithLocal();
    await createAdmin(app, {
      username: "lockme",
      email: "lockme@cabq.gov",
      displayName: "Lock Me",
      password: "LockPass!Word123",
      roles: [],
      mustChangePassword: false,
    });
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/local/login",
        headers: { "content-type": "application/json" },
        payload: { identifier: "lockme", password: "wrong!" },
      });
      expect(res.statusCode).toBe(401);
    }
    const locked = await app.inject({
      method: "POST",
      url: "/api/auth/local/login",
      headers: { "content-type": "application/json" },
      payload: { identifier: "lockme", password: "LockPass!Word123" },
    });
    expect(locked.statusCode).toBe(423);
    delete process.env.LOCAL_LOGIN_MAX_FAILS;
    await app.close();
  });

  it("cannot remove the last active admin", async () => {
    const { app } = await buildWithLocal();
    const created = await createAdmin(app, {
      username: "onlyadmin",
      email: "onlyadmin@cabq.gov",
      displayName: "Only Admin",
      password: "OnlyPass!Word123",
      roles: ["comp-plan-admin"],
      mustChangePassword: false,
    });
    const dto = JSON.parse(created.body) as { id: string };

    const demote = await app.inject({
      method: "PATCH",
      url: `/api/admin/users/${dto.id}`,
      headers: {
        "content-type": "application/json",
        "x-user-email": "seed-admin@cabq.gov",
        "x-user-roles": "comp-plan-admin",
      },
      payload: { roles: [] },
    });
    expect(demote.statusCode).toBe(409);

    const del = await app.inject({
      method: "DELETE",
      url: `/api/admin/users/${dto.id}`,
      headers: {
        "x-user-email": "seed-admin@cabq.gov",
        "x-user-roles": "comp-plan-admin",
      },
    });
    expect(del.statusCode).toBe(409);
    await app.close();
  });

  it("admin can reset a user's password and force next-login change", async () => {
    const { app } = await buildWithLocal();
    const created = await createAdmin(app, {
      username: "resetme",
      email: "resetme@cabq.gov",
      displayName: "Reset Me",
      password: "OldPass!Word1234",
      roles: [],
      mustChangePassword: false,
    });
    const dto = JSON.parse(created.body) as { id: string };

    const reset = await app.inject({
      method: "POST",
      url: `/api/admin/users/${dto.id}/reset-password`,
      headers: {
        "content-type": "application/json",
        "x-user-email": "seed-admin@cabq.gov",
        "x-user-roles": "comp-plan-admin",
      },
      payload: { password: "NewStrongerPass!99" },
    });
    expect(reset.statusCode).toBe(200);

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/local/login",
      headers: { "content-type": "application/json" },
      payload: { identifier: "resetme", password: "NewStrongerPass!99" },
    });
    expect(login.statusCode).toBe(200);
    const body = JSON.parse(login.body) as { user: { mustChangePassword: boolean } };
    expect(body.user.mustChangePassword).toBe(true);
    await app.close();
  });
});
