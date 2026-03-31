import { describe, expect, it } from "vitest";
import type { PlanData } from "./types";
import type { DraftSnapshot } from "./draftStorage";
import { validateDraftForExport, validateDraftForSave } from "./validation";

const plan: PlanData = {
  chapters: [
    {
      chapterNumber: 1,
      chapterTitle: "A",
      goals: [
        {
          goalNumber: "1.1",
          goalDescription: "G",
          goalDetails: [
            {
              detail: "D",
              policies: [
                {
                  policyNumber: "1.1.1",
                  policyDescription: "P",
                  subPolicies: [{ letter: "a", text: "t" }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

function baseSnap(over: Partial<DraftSnapshot> = {}): DraftSnapshot {
  return {
    chapterIdx: 0,
    goalIdx: 0,
    goalDetailIdx: 0,
    policyIdx: 0,
    subPolicyIdx: 0,
    subLevelIdx: -1,
    actionDetails: "1234567890abcd",
    title: "Valid title here",
    department: "",
    referenceId: "",
    ...over,
  };
}

describe("validateDraftForSave", () => {
  it("passes for complete selection and meta", () => {
    const r = validateDraftForSave(plan, baseSnap());
    expect(r.ok).toBe(true);
  });

  it("fails when title too short", () => {
    const r = validateDraftForSave(plan, baseSnap({ title: "ab" }));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("title"))).toBe(true);
  });

  it("fails when action text too short", () => {
    const r = validateDraftForSave(plan, baseSnap({ actionDetails: "short" }));
    expect(r.ok).toBe(false);
  });

  it("fails when sub-policy required but missing", () => {
    const r = validateDraftForSave(plan, baseSnap({ subPolicyIdx: -1 }));
    expect(r.ok).toBe(false);
  });
});

describe("validateDraftForExport", () => {
  it("passes without title when hierarchy complete", () => {
    const r = validateDraftForExport(
      plan,
      baseSnap({ title: "", actionDetails: "1234567890" }),
    );
    expect(r.ok).toBe(true);
  });
});
