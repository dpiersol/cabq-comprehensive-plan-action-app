import { describe, expect, it } from "vitest";
import type { PlanData } from "../types";
import { buildPlanSearchIndex } from "./buildPlanSearchIndex";
import { searchPlan } from "./searchPlan";

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
                  subPolicies: [{ letter: "a", text: "Alpha only" }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("searchPlan", () => {
  const entries = buildPlanSearchIndex(samplePlan);

  it("returns empty array for empty or whitespace query", () => {
    expect(searchPlan("", entries)).toEqual([]);
    expect(searchPlan("   ", entries)).toEqual([]);
  });

  it("finds entries by policy number fragment", () => {
    const hits = searchPlan("4.1.1", entries);
    expect(hits.some((h) => h.level === "policy")).toBe(true);
  });

  it("requires all tokens (AND)", () => {
    const hits = searchPlan("distinct zebra", entries);
    expect(hits.length).toBe(0);
  });

  it("matches multi-token when both appear in blob", () => {
    const hits = searchPlan("distinct communities", entries);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].searchBlob).toContain("distinct");
  });

  it("respects limit", () => {
    const many = searchPlan("4", entries, 2);
    expect(many.length).toBeLessThanOrEqual(2);
  });
});
