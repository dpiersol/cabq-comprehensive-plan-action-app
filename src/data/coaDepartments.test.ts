import { describe, expect, it } from "vitest";
import { COA_DEPARTMENTS } from "./coaDepartments";

describe("COA_DEPARTMENTS", () => {
  it("is sorted ascending (locale)", () => {
    const copy = [...COA_DEPARTMENTS];
    copy.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    expect(COA_DEPARTMENTS).toEqual(copy);
  });

  it("includes expected entries from source list", () => {
    expect(COA_DEPARTMENTS).toContain("Planning");
    expect(COA_DEPARTMENTS).toContain("Animal Welfare");
    expect(COA_DEPARTMENTS.length).toBe(31);
  });
});
