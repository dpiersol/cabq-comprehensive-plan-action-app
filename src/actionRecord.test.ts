import { describe, expect, it } from "vitest";
import { buildActionRecord } from "./actionRecord";

describe("buildActionRecord", () => {
  it("builds payload with nulls when nothing selected", () => {
    const r = buildActionRecord(
      "0.2.0",
      {
        chapter: undefined,
        goal: undefined,
        goalDetail: undefined,
        policy: undefined,
        subPolicy: undefined,
        subLevel: undefined,
      },
      "",
    );
    expect(r.chapter).toBeNull();
    expect(r.goal).toBeNull();
    expect(r.appVersion).toBe("0.2.0");
    expect(r.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
