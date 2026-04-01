import { describe, expect, it } from "vitest";
import type { PlanData } from "../types";
import { buildPlanSearchIndex } from "./buildPlanSearchIndex";

const samplePlan: PlanData = {
  chapters: [
    {
      chapterNumber: 4,
      chapterTitle: "Community Identity",
      goals: [
        {
          goalNumber: "4.1",
          goalDescription: "Character",
          goalDetails: [
            {
              detail: "Enhance distinct communities.",
              policies: [
                {
                  policyNumber: "4.1.1",
                  policyDescription: "Distinct Communities",
                  subPolicies: [
                    {
                      letter: "a",
                      text: "See Goal 4.3 for CPA character.",
                    },
                    {
                      letter: "b",
                      text: "Unique zebra crossing policy text.",
                      subLevels: [{ roman: "i.", description: "First sub-level line" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("buildPlanSearchIndex", () => {
  it("includes chapter, goal, goal detail, policy, sub-policies, and sub-level rows", () => {
    const idx = buildPlanSearchIndex(samplePlan);
    const levels = idx.map((e) => e.level);
    expect(levels).toContain("chapter");
    expect(levels).toContain("goal");
    expect(levels).toContain("goalDetail");
    expect(levels).toContain("policy");
    expect(levels).toContain("subPolicy");
    expect(levels).toContain("subLevel");
  });

  it("indexes policy number and description in searchBlob", () => {
    const idx = buildPlanSearchIndex(samplePlan);
    const policyHit = idx.find((e) => e.level === "policy");
    expect(policyHit).toBeDefined();
    expect(policyHit!.searchBlob).toContain("4.1.1");
    expect(policyHit!.searchBlob).toContain("distinct");
  });

  it("embeds full ancestor chain in every row (chapter through policy text)", () => {
    const idx = buildPlanSearchIndex(samplePlan);
    const policyHit = idx.find((e) => e.level === "policy")!;
    expect(policyHit.searchBlob).toContain("community");
    expect(policyHit.searchBlob).toContain("character");
    expect(policyHit.searchBlob).toContain("enhance");
  });

  it("stores correct indices for a sub-level entry", () => {
    const idx = buildPlanSearchIndex(samplePlan);
    const sl = idx.find((e) => e.level === "subLevel");
    expect(sl).toBeDefined();
    expect(sl!.chapterIdx).toBe(0);
    expect(sl!.goalIdx).toBe(0);
    expect(sl!.goalDetailIdx).toBe(0);
    expect(sl!.policyIdx).toBe(0);
    expect(sl!.subPolicyIdx).toBe(1);
    expect(sl!.subLevelIdx).toBe(0);
  });

  it("produces unique ids", () => {
    const idx = buildPlanSearchIndex(samplePlan);
    const ids = new Set(idx.map((e) => e.id));
    expect(ids.size).toBe(idx.length);
  });
});
