import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildServer } from "./app.js";
import { createMemoryDatabase } from "./db/database.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8")) as { version: string };

const samplePdfPayload = {
  currentDate: "Monday, March 31, 2026",
  legislationTitle: "Test title",
  chapter: "1 — Chapter",
  goal: "G — Goal",
  policy: "P — Policy",
  legislationDescription: "Description text.",
  howDoesLegislationFurtherPolicies: "Furtherance text.",
};

const ownerHeaders = {
  "content-type": "application/json",
  "x-user-email": "tester@cabq.gov",
  "x-user-oid": "test-oid-1",
};

const ownerIdentityHeaders = {
  "x-user-email": "tester@cabq.gov",
  "x-user-oid": "test-oid-1",
};

const sampleSnapshot = {
  planItems: [
    {
      chapterIdx: 0,
      goalIdx: -1,
      goalDetailIdx: -1,
      policyIdx: -1,
      subPolicyIdx: -1,
      subLevelIdx: -1,
    },
  ],
  actionDetails: "",
  actionTitle: "Hello",
  howFurthersPolicies: "",
  department: "",
  primaryContact: { name: "", role: "", email: "", phone: "" },
  alternateContact: { name: "", role: "", email: "", phone: "" },
};

describe("API", () => {
  it(
    "health includes package version",
    async () => {
      const db = createMemoryDatabase();
      const app = buildServer({ db });
      const res = await app.inject({ method: "GET", url: "/api/health" });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as {
        ok: boolean;
        version: string;
        workflow: string;
        submissions: string;
      };
      expect(body.ok).toBe(true);
      expect(body.version).toBe(pkg.version);
      expect(body.workflow).toBe("shelved");
      expect(body.submissions).toBe("sqlite");
      await app.close();
    },
    15_000,
  );

  it(
    "POST /api/submissions/pdf returns PDF bytes",
    async () => {
      const db = createMemoryDatabase();
      const app = buildServer({ db });
      const res = await app.inject({
        method: "POST",
        url: "/api/submissions/pdf",
        headers: { "content-type": "application/json" },
        payload: samplePdfPayload,
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
      expect(res.rawPayload.length).toBeGreaterThan(100);
      await app.close();
    },
    15_000,
  );

  it(
    "submissions CRUD with owner headers",
    async () => {
      const db = createMemoryDatabase();
      const app = buildServer({ db });

      const create = await app.inject({
        method: "POST",
        url: "/api/submissions",
        headers: ownerHeaders,
        payload: { snapshot: sampleSnapshot },
      });
      expect(create.statusCode).toBe(200);
      const created = JSON.parse(create.body) as {
        id: string;
        cpRecordId: string;
        status: string;
        submittedAt: string | null;
        snapshot: unknown;
      };
      expect(created.cpRecordId).toMatch(/^CP-/);
      expect(created.status).toBe("draft");
      expect(created.submittedAt).toBeNull();
      expect((created.snapshot as { actionTitle: string }).actionTitle).toBe("Hello");

      const list = await app.inject({
        method: "GET",
        url: "/api/submissions",
        headers: ownerHeaders,
      });
      expect(list.statusCode).toBe(200);
      const rows = JSON.parse(list.body) as {
        status: string;
        submittedAt: string | null;
      }[];
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("draft");
      expect(rows[0].submittedAt).toBeNull();

      const patch = await app.inject({
        method: "PATCH",
        url: `/api/submissions/${created.id}`,
        headers: ownerHeaders,
        payload: {
          snapshot: {
            ...sampleSnapshot,
            actionTitle: "Updated",
          },
        },
      });
      expect(patch.statusCode).toBe(200);

      const del = await app.inject({
        method: "DELETE",
        url: `/api/submissions/${created.id}`,
        headers: {
          "x-user-email": "tester@cabq.gov",
          "x-user-oid": "test-oid-1",
        },
      });
      expect(del.statusCode).toBe(200);

      const list2 = await app.inject({
        method: "GET",
        url: "/api/submissions",
        headers: ownerHeaders,
      });
      expect(JSON.parse(list2.body) as unknown[]).toHaveLength(0);

      await app.close();
    },
    15_000,
  );

  it(
    "DELETE submitted submission returns 409",
    async () => {
      const db = createMemoryDatabase();
      const app = buildServer({ db });

      const create = await app.inject({
        method: "POST",
        url: "/api/submissions",
        headers: ownerHeaders,
        payload: { snapshot: sampleSnapshot, status: "submitted" },
      });
      expect(create.statusCode).toBe(200);
      const created = JSON.parse(create.body) as { id: string; status: string };
      expect(created.status).toBe("submitted");

      const del = await app.inject({
        method: "DELETE",
        url: `/api/submissions/${created.id}`,
        headers: ownerIdentityHeaders,
      });
      expect(del.statusCode).toBe(409);
      const err = JSON.parse(del.body) as { error: string };
      expect(err.error).toContain("draft");

      await app.close();
    },
    15_000,
  );

  it(
    "GET /api/submissions rejects without identity headers",
    async () => {
      const db = createMemoryDatabase();
      const app = buildServer({ db });
      const res = await app.inject({ method: "GET", url: "/api/submissions" });
      expect(res.statusCode).toBe(401);
      await app.close();
    },
    15_000,
  );

  it(
    "admin endpoints list across owners and require admin role",
    async () => {
      const prev = process.env.ADMIN_EMAILS;
      try {
        process.env.ADMIN_EMAILS = "admin@cabq.gov";
        const db = createMemoryDatabase();
        const app = buildServer({ db });

        const userA = await app.inject({
          method: "POST",
          url: "/api/submissions",
          headers: ownerHeaders,
          payload: { snapshot: sampleSnapshot, status: "submitted" },
        });
        expect(userA.statusCode).toBe(200);

        const userB = await app.inject({
          method: "POST",
          url: "/api/submissions",
          headers: {
            "content-type": "application/json",
            "x-user-email": "second@cabq.gov",
            "x-user-oid": "oid-second",
          },
          payload: { snapshot: { ...sampleSnapshot, actionTitle: "Second" } },
        });
        expect(userB.statusCode).toBe(200);

        const forbid = await app.inject({
          method: "GET",
          url: "/api/admin/submissions",
          headers: ownerIdentityHeaders,
        });
        expect(forbid.statusCode).toBe(403);

        const adminHeaders = {
          "x-user-email": "admin@cabq.gov",
          "x-user-oid": "admin-oid",
        };
        const listAll = await app.inject({
          method: "GET",
          url: "/api/admin/submissions",
          headers: adminHeaders,
        });
        expect(listAll.statusCode).toBe(200);
        const rows = JSON.parse(listAll.body) as { id: string; ownerEmail: string }[];
        expect(rows).toHaveLength(2);
        expect(rows.map((r) => r.ownerEmail).sort()).toEqual(["second@cabq.gov", "tester@cabq.gov"]);

        const adminRoleHeaders = {
          "x-user-email": "roleuser@cabq.gov",
          "x-user-oid": "role-oid",
          "x-user-roles": "comp-plan-admin",
        };
        const byRole = await app.inject({
          method: "GET",
          url: "/api/admin/submissions",
          headers: adminRoleHeaders,
        });
        expect(byRole.statusCode).toBe(200);

        const otherId = (JSON.parse(userB.body) as { id: string }).id;
        const patchAny = await app.inject({
          method: "PATCH",
          url: `/api/admin/submissions/${otherId}`,
          headers: {
            "content-type": "application/json",
            ...adminHeaders,
          },
          payload: {
            snapshot: { ...sampleSnapshot, actionTitle: "Admin edit" },
          },
        });
        expect(patchAny.statusCode).toBe(200);
        const patched = JSON.parse(patchAny.body) as { snapshot: { actionTitle: string } };
        expect(patched.snapshot.actionTitle).toBe("Admin edit");

        await app.close();
      } finally {
        if (prev === undefined) delete process.env.ADMIN_EMAILS;
        else process.env.ADMIN_EMAILS = prev;
      }
    },
    15_000,
  );

  it(
    "GET /api/submissions rejects header-only auth when Azure JWT is required (no header fallback)",
    async () => {
      const prevTenant = process.env.AZURE_TENANT_ID;
      const prevAudience = process.env.AZURE_AUDIENCE;
      const prevAllow = process.env.ALLOW_HEADER_IDENTITY;
      try {
        process.env.AZURE_TENANT_ID = "11111111-1111-1111-1111-111111111111";
        process.env.AZURE_AUDIENCE = "api://cabq-plan-test";
        delete process.env.ALLOW_HEADER_IDENTITY;
        const db = createMemoryDatabase();
        const app = buildServer({ db });
        const res = await app.inject({
          method: "GET",
          url: "/api/submissions",
          headers: ownerIdentityHeaders,
        });
        expect(res.statusCode).toBe(401);
        await app.close();
      } finally {
        if (prevTenant === undefined) delete process.env.AZURE_TENANT_ID;
        else process.env.AZURE_TENANT_ID = prevTenant;
        if (prevAudience === undefined) delete process.env.AZURE_AUDIENCE;
        else process.env.AZURE_AUDIENCE = prevAudience;
        if (prevAllow === undefined) delete process.env.ALLOW_HEADER_IDENTITY;
        else process.env.ALLOW_HEADER_IDENTITY = prevAllow;
      }
    },
    15_000,
  );
});
