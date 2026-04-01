import { describe, expect, it } from "vitest";
import { buildActionRecord } from "./actionRecord";
import { emptyContact } from "./contacts";

describe("buildActionRecord", () => {
  it("builds payload with nulls when nothing selected", () => {
    const r = buildActionRecord(
      "0.8.0",
      {
        actionTitle: "T",
        department: "D",
        primaryContact: { ...emptyContact(), name: "A" },
        alternateContact: emptyContact(),
        attachments: [],
      },
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
    expect(r.appVersion).toBe("0.8.0");
    expect(r.actionTitle).toBe("T");
    expect(r.department).toBe("D");
    expect(r.primaryContact.name).toBe("A");
    expect(r.attachments).toEqual([]);
    expect(r.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
