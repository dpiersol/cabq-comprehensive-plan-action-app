import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildServer } from "./app.js";

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

describe("API", () => {
  it("health includes package version", async () => {
    const app = buildServer();
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { ok: boolean; version: string; workflow: string };
    expect(body).toEqual({ ok: true, version: pkg.version, workflow: "shelved" });
    await app.close();
  });

  it(
    "POST /api/submissions/pdf returns PDF bytes",
    async () => {
      const app = buildServer();
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
});
