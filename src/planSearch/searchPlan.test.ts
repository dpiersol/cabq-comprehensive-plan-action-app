import { describe, expect, it } from "vitest";
import type { PlanData } from "../types";
import type { PlanSearchEntry } from "./types";
import { buildPlanSearchIndex } from "./buildPlanSearchIndex";
import { SEARCH_LEVEL_ORDER, searchPlan, tokenScore } from "./searchPlan";

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

  it("interleaves by hierarchy level so chapter is not buried under sub-level matches", () => {
    const shared = "unique-shared-marker-xyz";
    const synthetic: PlanSearchEntry[] = [
      {
        id: "ch",
        level: "chapter",
        chapterIdx: 0,
        goalIdx: -1,
        goalDetailIdx: -1,
        policyIdx: -1,
        subPolicyIdx: -1,
        subLevelIdx: -1,
        breadcrumb: "Ch",
        label: "Ch",
        searchBlob: `${shared} chapter only`,
      },
      {
        id: "sl",
        level: "subLevel",
        chapterIdx: 0,
        goalIdx: 0,
        goalDetailIdx: 0,
        policyIdx: 0,
        subPolicyIdx: 0,
        subLevelIdx: 0,
        breadcrumb: "Deep",
        label: "Deep",
        searchBlob: `${shared} leaf text`,
      },
      {
        id: "sl2",
        level: "subLevel",
        chapterIdx: 0,
        goalIdx: 0,
        goalDetailIdx: 0,
        policyIdx: 0,
        subPolicyIdx: 0,
        subLevelIdx: 1,
        breadcrumb: "Deep2",
        label: "Deep2",
        searchBlob: `${shared} second leaf`,
      },
    ];
    const hits = searchPlan(shared, synthetic, 10);
    expect(hits[0].level).toBe("chapter");
    expect(hits.some((h) => h.id === "sl")).toBe(true);
  });

  it("orders rounds as chapter, goal, …, subLevel in SEARCH_LEVEL_ORDER", () => {
    expect(SEARCH_LEVEL_ORDER[0]).toBe("chapter");
    expect(SEARCH_LEVEL_ORDER[SEARCH_LEVEL_ORDER.length - 1]).toBe("subLevel");
  });
});

describe("tokenScore", () => {
  it("returns -1 if any token is missing", () => {
    expect(tokenScore("hello world", ["hello", "nope"])).toBe(-1);
  });

  it("scores higher when tokens appear earlier in the blob", () => {
    const early = tokenScore("alpha beta gamma", ["alpha"]);
    const late = tokenScore("xxxxx alpha beta gamma", ["alpha"]);
    expect(early).toBeGreaterThan(late);
  });
});
