import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "./app.js";

describe("API", () => {
  beforeEach(() => {
    process.env.WORKFLOW_DB_PATH = join(tmpdir(), `cabq-wf-test-${randomUUID()}.db`);
  });
  afterEach(() => {
    delete process.env.WORKFLOW_DB_PATH;
  });

  it("health", async () => {
    const app = buildServer();
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true, version: "0.9.0" });
    await app.close();
  });

  it("creates submission", async () => {
    const app = buildServer();
    const snap = {
      chapterIdx: 0,
      goalIdx: 0,
      goalDetailIdx: 0,
      policyIdx: 0,
      subPolicyIdx: -1,
      subLevelIdx: -1,
      actionDetails: "12345678901",
      actionTitle: "T",
      department: "",
      primaryContact: { name: "A", role: "R", email: "a@b.gov", phone: "5055550100" },
      alternateContact: { name: "", role: "", email: "", phone: "" },
      attachments: [],
    };
    const res = await app.inject({
      method: "POST",
      url: "/api/submissions",
      payload: { snapshot: snap },
    });
    expect(res.statusCode).toBe(200);
    const j = JSON.parse(res.body) as { id: string; status: string };
    expect(j.status).toBe("PlanningReview");
    await app.close();
  });
});
