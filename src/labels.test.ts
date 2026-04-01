import { describe, expect, it } from "vitest";
import {
  chapterLabel,
  goalLabel,
  policyLabel,
  subLevelLabel,
  subPolicyOptionLabel,
} from "./labels";

describe("labels", () => {
  it("formats chapter", () => {
    expect(chapterLabel({ chapterNumber: 4, chapterTitle: "Community Identity" })).toBe(
      "4 — Community Identity",
    );
  });

  it("formats goal", () => {
    expect(goalLabel({ goalNumber: "4.1", goalDescription: "Character" })).toBe("4.1 — Character");
  });

  it("formats policy", () => {
    expect(policyLabel({ policyNumber: "4.1.1", policyDescription: "Distinct Communities" })).toBe(
      "4.1.1 — Distinct Communities",
    );
  });

  it("formats sub-policy with letter and text", () => {
    expect(
      subPolicyOptionLabel({ letter: "a", text: "See Goal 4.3 below." }, 0),
    ).toBe("a. See Goal 4.3 below.");
  });

  it("formats sub-policy without letter", () => {
    expect(
      subPolicyOptionLabel(
        { description: "Encourage quality development that is consistent with the distinct character of communities." },
        0,
      ),
    ).toContain("Encourage quality development");
  });

  it("formats sub-level", () => {
    expect(subLevelLabel({ roman: "i.", description: "First item" })).toBe("i. First item");
  });

  it("handles null roman or description from plan data", () => {
    expect(subLevelLabel({ roman: null, description: "Only description" })).toBe("Only description");
    expect(subLevelLabel({ roman: "i.", description: null })).toBe("i.");
    expect(subLevelLabel({ roman: null, description: null })).toBe("(Sub-level)");
  });
});
