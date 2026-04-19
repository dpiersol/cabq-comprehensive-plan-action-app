import { describe, expect, it } from "vitest";
import { buildServer } from "../app.js";
import { createMemoryDatabase } from "../db/database.js";
import { insertSubmission } from "../submissionsRepo.js";
import { insertUser } from "../localUsersRepo.js";
import { hashPassword } from "../passwords.js";

const ADMIN_HEADERS = {
  "x-user-email": "admin@cabq.gov",
  "x-user-roles": "comp-plan-admin",
};

const USER_HEADERS = {
  "x-user-email": "user@cabq.gov",
  "x-user-roles": "comp-plan-user",
};

function buildWithMemoryDb() {
  const db = createMemoryDatabase();
  const app = buildServer({ db });
  return { db, app };
}

function snapshotWithGoals(pairs: { chapterIdx: number; goalIdx: number }[]) {
  return {
    planItems: pairs.map((p) => ({
      chapterIdx: p.chapterIdx,
      goalIdx: p.goalIdx,
      goalDetailIdx: 0,
      policyIdx: 0,
      subPolicyIdx: -1,
      subLevelIdx: -1,
    })),
    actionDetails: "test",
    actionTitle: "t",
    howFurthersPolicies: "",
    department: "d",
    primaryContact: {},
    alternateContact: {},
  };
}

describe("reports routes", () => {
  // Header fallback is automatically enabled in tests because AZURE_* env
  // vars are unset (see allowHeaderFallback()). No extra setup needed.

  it("rejects unauthenticated callers with 401", async () => {
    const { app } = buildWithMemoryDb();
    const r1 = await app.inject({
      method: "GET",
      url: "/api/admin/reports/submissions-overview",
    });
    expect(r1.statusCode).toBe(401);
    const r2 = await app.inject({
      method: "GET",
      url: "/api/admin/reports/user-activity",
    });
    expect(r2.statusCode).toBe(401);
    await app.close();
  });

  it("rejects non-admin authenticated callers with 403", async () => {
    const { app } = buildWithMemoryDb();
    const r = await app.inject({
      method: "GET",
      url: "/api/admin/reports/submissions-overview",
      headers: USER_HEADERS,
    });
    expect(r.statusCode).toBe(403);
    await app.close();
  });

  it("submissions-overview aggregates totals + top goals", async () => {
    const { db, app } = buildWithMemoryDb();

    // 3 submitted + 1 draft. Goal (0,0) appears 3 times, (1,2) once.
    insertSubmission(
      db,
      "email:a@cabq.gov",
      snapshotWithGoals([{ chapterIdx: 0, goalIdx: 0 }]),
      "submitted",
      "a@cabq.gov",
    );
    insertSubmission(
      db,
      "email:b@cabq.gov",
      snapshotWithGoals([{ chapterIdx: 0, goalIdx: 0 }]),
      "submitted",
      "b@cabq.gov",
    );
    insertSubmission(
      db,
      "email:c@cabq.gov",
      snapshotWithGoals([{ chapterIdx: 1, goalIdx: 2 }]),
      "submitted",
      "c@cabq.gov",
    );
    insertSubmission(
      db,
      "email:a@cabq.gov",
      snapshotWithGoals([{ chapterIdx: 0, goalIdx: 0 }]),
      "draft",
      "a@cabq.gov",
    );

    const r = await app.inject({
      method: "GET",
      url: "/api/admin/reports/submissions-overview",
      headers: ADMIN_HEADERS,
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      kpis: {
        total: number;
        draft: number;
        submitted: number;
        createdLast7d: number;
      };
      topGoals: { chapterIdx: number; goalIdx: number; count: number }[];
      weekly: { weekStart: string; count: number }[];
      unmapped: number;
    };
    expect(body.kpis.total).toBe(4);
    expect(body.kpis.draft).toBe(1);
    expect(body.kpis.submitted).toBe(3);
    expect(body.kpis.createdLast7d).toBe(4);
    expect(body.topGoals[0]).toEqual({ chapterIdx: 0, goalIdx: 0, count: 3 });
    expect(body.topGoals[1]).toEqual({ chapterIdx: 1, goalIdx: 2, count: 1 });
    expect(body.weekly.length).toBe(13);
    expect(body.unmapped).toBe(0);
    await app.close();
  });

  it("user-activity lists local users + non-local submitters with correct admin totals", async () => {
    const { db, app } = buildWithMemoryDb();

    // A local admin user in the DB.
    insertUser(db, {
      username: "theadmin",
      email: "theadmin@cabq.gov",
      displayName: "The Admin",
      passwordHash: await hashPassword("StrongPass!123"),
      roles: ["comp-plan-admin"],
    });
    // A local non-admin user.
    insertUser(db, {
      username: "plain",
      email: "plain@cabq.gov",
      displayName: "Plain User",
      passwordHash: await hashPassword("StrongPass!123"),
      roles: ["comp-plan-user"],
    });

    // Two submissions from a non-local email, one from the local admin.
    insertSubmission(
      db,
      "email:visitor@external.org",
      snapshotWithGoals([{ chapterIdx: 0, goalIdx: 0 }]),
      "submitted",
      "visitor@external.org",
    );
    insertSubmission(
      db,
      "email:visitor@external.org",
      snapshotWithGoals([{ chapterIdx: 0, goalIdx: 0 }]),
      "draft",
      "visitor@external.org",
    );
    insertSubmission(
      db,
      "email:theadmin@cabq.gov",
      snapshotWithGoals([{ chapterIdx: 0, goalIdx: 0 }]),
      "draft",
      "theadmin@cabq.gov",
    );

    const r = await app.inject({
      method: "GET",
      url: "/api/admin/reports/user-activity",
      headers: ADMIN_HEADERS,
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      localUsers: {
        username: string;
        email: string;
        roles: string[];
        submissionsTotal: number;
        isActive: boolean;
      }[];
      nonLocalSubmitters: { email: string; submissionsTotal: number }[];
      totals: {
        admins: number;
        localUsers: number;
        activeLocalUsers: number;
      };
    };
    expect(body.totals.localUsers).toBe(2);
    expect(body.totals.admins).toBe(1);
    expect(body.totals.activeLocalUsers).toBe(2);
    const adminRow = body.localUsers.find((u) => u.username === "theadmin");
    expect(adminRow).toBeDefined();
    expect(adminRow!.roles).toContain("comp-plan-admin");
    expect(adminRow!.submissionsTotal).toBe(1);
    const visitor = body.nonLocalSubmitters.find(
      (u) => u.email === "visitor@external.org",
    );
    expect(visitor).toBeDefined();
    expect(visitor!.submissionsTotal).toBe(2);
    await app.close();
  });

  it("submissions-overview clamps weeks parameter to [4, 52]", async () => {
    const { app } = buildWithMemoryDb();
    const low = await app.inject({
      method: "GET",
      url: "/api/admin/reports/submissions-overview?weeks=1",
      headers: ADMIN_HEADERS,
    });
    expect(low.statusCode).toBe(200);
    expect((low.json() as { weekly: unknown[] }).weekly.length).toBe(4);

    const high = await app.inject({
      method: "GET",
      url: "/api/admin/reports/submissions-overview?weeks=9999",
      headers: ADMIN_HEADERS,
    });
    expect(high.statusCode).toBe(200);
    expect((high.json() as { weekly: unknown[] }).weekly.length).toBe(52);
    await app.close();
  });
});
