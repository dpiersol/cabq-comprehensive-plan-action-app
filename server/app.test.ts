import { describe, expect, it } from "vitest";
import { buildServer } from "./app.js";

describe("API (minimal)", () => {
  it(
    "health",
    async () => {
      const app = buildServer();
      const res = await app.inject({ method: "GET", url: "/api/health" });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({
        ok: true,
        version: "0.11.3",
        workflow: "shelved",
      });
      await app.close();
    },
    15_000,
  );
});
