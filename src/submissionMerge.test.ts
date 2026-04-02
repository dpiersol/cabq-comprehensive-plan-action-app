import { describe, expect, it } from "vitest";
import { emptyDraft, emptyPlanItem } from "./draftStorage";
import { buildSubmissionPdfPayload } from "./submissionMerge";
import type { PlanData } from "./types";

const minimalPlan: PlanData = {
  chapters: [
    {
      chapterNumber: 1,
      chapterTitle: "Test chapter",
      goals: [
        {
          goalNumber: "G1",
          goalDescription: "Test goal",
          goalDetails: [
            {
              detail: "Detail line",
              policies: [
                {
                  policyNumber: "P1",
                  policyDescription: "Pol",
                  subPolicies: [],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("buildSubmissionPdfPayload", () => {
  it("maps draft fields to PDF merge keys", () => {
    const snap = {
      ...emptyDraft(),
      planItems: [
        {
          ...emptyPlanItem(),
          chapterIdx: 0,
          goalIdx: 0,
          goalDetailIdx: 0,
          policyIdx: 0,
        },
      ],
      actionTitle: "My law",
      actionDetails: "<p>Hello world</p>",
      howFurthersPolicies: "Because it aligns with the plan.",
    };
    const p = buildSubmissionPdfPayload(minimalPlan, snap);
    expect(p.legislationTitle).toBe("My law");
    expect(p.legislationDescription).toBe("Hello world");
    expect(p.howDoesLegislationFurtherPolicies).toBe("Because it aligns with the plan.");
    expect(p.chapter).toContain("1 — Test chapter");
    expect(p.goal).toContain("G1");
    expect(p.policy).toContain("P1");
    expect(p.currentDate.length).toBeGreaterThan(4);
  });
});
