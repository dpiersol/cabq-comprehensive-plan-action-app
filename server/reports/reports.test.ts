import { afterAll, describe, expect, it } from "vitest";
import { buildServer } from "../app.js";
import { createMemoryDatabase } from "../db/database.js";
import { insertSubmission } from "../submissionsRepo.js";
import { insertUser } from "../localUsersRepo.js";
import { hashPassword } from "../passwords.js";
import { recordAudit } from "../auditRepo.js";
import {
  resetPlanCacheForTests,
  setPlanDataForTests,
} from "./reportsRepo.js";

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

  // Reset the coverage plan cache after these tests to avoid leakage
  // between test files (the disk fallback is desirable in production).
  afterAll(() => {
    resetPlanCacheForTests();
  });

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

  // -----------------------------------------------------------------------
  // Report 3 — Authentication & Security
  // -----------------------------------------------------------------------

  it("auth-security rolls up audit events into categories + failure watchlist", async () => {
    const { db, app } = buildWithMemoryDb();

    recordAudit(db, {
      action: "local_login_success",
      actor: "good@cabq.gov",
      target: "u-1",
    });
    recordAudit(db, {
      action: "local_login_failed",
      actor: "bad@cabq.gov",
      target: null,
      detail: { reason: "bad_password", ip: "10.0.0.1" },
    });
    recordAudit(db, {
      action: "local_login_failed",
      actor: "bad@cabq.gov",
      target: null,
      detail: { reason: "bad_password", ip: "10.0.0.2" },
    });
    recordAudit(db, {
      action: "local_login_failed",
      actor: "bad@cabq.gov",
      target: null,
      detail: { reason: "locked", ip: "10.0.0.1" },
    });
    recordAudit(db, { action: "admin_user_create", actor: "admin@cabq.gov" });
    recordAudit(db, { action: "admin_role_create", actor: "admin@cabq.gov" });
    recordAudit(db, {
      action: "admin_auth_config_update",
      actor: "admin@cabq.gov",
    });
    recordAudit(db, {
      action: "admin_user_reset_password",
      actor: "admin@cabq.gov",
    });

    const r = await app.inject({
      method: "GET",
      url: "/api/admin/reports/auth-security?days=7",
      headers: ADMIN_HEADERS,
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      windowDays: number;
      totals: {
        loginSuccess: number;
        loginFailed: number;
        lockouts: number;
        userChange: number;
        roleChange: number;
        ssoConfig: number;
        passwordChange: number;
      };
      daily: { date: string; counts: Record<string, number> }[];
      failureWatchlist: { actor: string; failures: number; distinctIps: number }[];
      recent: { action: string; category: string | null }[];
    };
    expect(body.windowDays).toBe(7);
    expect(body.totals.loginSuccess).toBe(1);
    expect(body.totals.loginFailed).toBe(3);
    expect(body.totals.lockouts).toBe(1);
    expect(body.totals.userChange).toBe(1);
    expect(body.totals.roleChange).toBe(1);
    expect(body.totals.ssoConfig).toBe(1);
    expect(body.totals.passwordChange).toBe(1);
    expect(body.daily.length).toBe(7);
    // Watchlist should surface the repeated-failure actor with 2 distinct IPs.
    const entry = body.failureWatchlist.find((f) => f.actor === "bad@cabq.gov");
    expect(entry).toBeDefined();
    expect(entry!.failures).toBe(3);
    expect(entry!.distinctIps).toBe(2);
    expect(body.recent.length).toBeGreaterThan(0);
    await app.close();
  });

  it("auth-security clamps days parameter to [7, 180]", async () => {
    const { app } = buildWithMemoryDb();
    const low = await app.inject({
      method: "GET",
      url: "/api/admin/reports/auth-security?days=1",
      headers: ADMIN_HEADERS,
    });
    expect(low.statusCode).toBe(200);
    expect((low.json() as { windowDays: number }).windowDays).toBe(7);
    const high = await app.inject({
      method: "GET",
      url: "/api/admin/reports/auth-security?days=9999",
      headers: ADMIN_HEADERS,
    });
    expect(high.statusCode).toBe(200);
    expect((high.json() as { windowDays: number }).windowDays).toBe(180);
    await app.close();
  });

  it("auth-audit.csv streams well-formed CSV with headers + quoting", async () => {
    const { db, app } = buildWithMemoryDb();
    recordAudit(db, {
      action: "local_login_failed",
      actor: 'someone, with "quotes"',
      target: null,
      detail: { reason: "bad_password" },
    });
    const r = await app.inject({
      method: "GET",
      url: "/api/admin/reports/auth-audit.csv?days=1",
      headers: ADMIN_HEADERS,
    });
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toMatch(/text\/csv/);
    expect(r.headers["content-disposition"]).toMatch(/attachment;.*\.csv/);
    const lines = r.body.split(/\r\n/).filter(Boolean);
    expect(lines[0]).toBe("id,at,action,category,actor,target,detail");
    // Row with a comma/quote-containing actor must be properly quoted.
    expect(lines[1]).toContain('"someone, with ""quotes"""');
    expect(lines[1]).toContain("local_login_failed");
    expect(lines[1]).toContain("login_failed");
    await app.close();
  });

  // -----------------------------------------------------------------------
  // Report 5 — Coverage / Gap Analysis
  // -----------------------------------------------------------------------

  it("coverage returns planLoaded=false and empty totals when no hierarchy", async () => {
    setPlanDataForTests(null);
    const { app } = buildWithMemoryDb();
    const r = await app.inject({
      method: "GET",
      url: "/api/admin/reports/coverage",
      headers: ADMIN_HEADERS,
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      planLoaded: boolean;
      totals: { chapters: number };
    };
    expect(body.planLoaded).toBe(false);
    expect(body.totals.chapters).toBe(0);
    await app.close();
  });

  it("coverage counts covered/uncovered goals against a test plan", async () => {
    // Tiny synthetic plan: Chapter 0 with 3 goals, Chapter 1 with 2 goals.
    setPlanDataForTests({
      chapters: [
        {
          chapterNumber: 1,
          chapterTitle: "Alpha",
          goals: [
            { goalNumber: "1.1", goalDescription: "G1", goalDetails: [] },
            { goalNumber: "1.2", goalDescription: "G2", goalDetails: [] },
            { goalNumber: "1.3", goalDescription: "G3", goalDetails: [] },
          ],
        },
        {
          chapterNumber: 2,
          chapterTitle: "Beta",
          goals: [
            { goalNumber: "2.1", goalDescription: "G1", goalDetails: [] },
            { goalNumber: "2.2", goalDescription: "G2", goalDetails: [] },
          ],
        },
      ],
    });

    const { db, app } = buildWithMemoryDb();

    // 3 submissions covering (0,0), (0,1), and (1,0). Goals (0,2) and (1,1)
    // should be flagged uncovered.
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
      snapshotWithGoals([
        { chapterIdx: 0, goalIdx: 0 },
        { chapterIdx: 0, goalIdx: 1 },
      ]),
      "submitted",
      "b@cabq.gov",
    );
    insertSubmission(
      db,
      "email:c@cabq.gov",
      snapshotWithGoals([{ chapterIdx: 1, goalIdx: 0 }]),
      "draft",
      "c@cabq.gov",
    );

    const r = await app.inject({
      method: "GET",
      url: "/api/admin/reports/coverage",
      headers: ADMIN_HEADERS,
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      planLoaded: boolean;
      totals: {
        chapters: number;
        goals: number;
        goalsCovered: number;
        goalsUncovered: number;
        submissionsMapped: number;
      };
      byChapter: {
        chapterIdx: number;
        goalsTotal: number;
        goalsCovered: number;
        submissions: number;
      }[];
      uncoveredGoals: { chapterIdx: number; goalIdx: number }[];
      topGoals: { chapterIdx: number; goalIdx: number; count: number }[];
    };
    expect(body.planLoaded).toBe(true);
    expect(body.totals.chapters).toBe(2);
    expect(body.totals.goals).toBe(5);
    expect(body.totals.goalsCovered).toBe(3);
    expect(body.totals.goalsUncovered).toBe(2);
    expect(body.totals.submissionsMapped).toBe(3);
    // Chapter 0: 3 goals, 2 covered, 2 submissions touched it.
    const ch0 = body.byChapter.find((c) => c.chapterIdx === 0);
    expect(ch0).toEqual(
      expect.objectContaining({
        goalsTotal: 3,
        goalsCovered: 2,
        submissions: 2,
      }),
    );
    expect(body.uncoveredGoals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ chapterIdx: 0, goalIdx: 2 }),
        expect.objectContaining({ chapterIdx: 1, goalIdx: 1 }),
      ]),
    );
    // Top goal should be (0,0) with 2 citations.
    expect(body.topGoals[0]).toEqual(
      expect.objectContaining({ chapterIdx: 0, goalIdx: 0, count: 2 }),
    );
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
