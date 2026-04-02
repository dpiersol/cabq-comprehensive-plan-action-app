import { describe, expect, it } from "vitest";
import { buildActionRecord, buildActionRecordFromSnapshot } from "./actionRecord";
import { emptyContact } from "./contacts";
import { emptyPlanItem } from "./draftStorage";
import type { PlanData } from "./types";

const minimalPlan: PlanData = {
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

describe("buildActionRecord", () => {
  it("builds payload with null hierarchy entries when nothing selected", () => {
    const r = buildActionRecord(
      "0.11.2",
      {
        actionTitle: "T",
        department: "D",
        primaryContact: { ...emptyContact(), name: "A" },
        alternateContact: emptyContact(),
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
    expect(r.compPlanItems).toHaveLength(1);
    expect(r.compPlanItems[0].chapter).toBeNull();
    expect(r.compPlanItems[0].goal).toBeNull();
    expect(r.appVersion).toBe("0.11.2");
    expect(r.actionTitle).toBe("T");
    expect(r.department).toBe("D");
    expect(r.primaryContact.name).toBe("A");
    expect(r.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("buildActionRecordFromSnapshot", () => {
  it("exports one compPlanItems row per plan item", () => {
    const r = buildActionRecordFromSnapshot(minimalPlan, "0.11.2", {
      planItems: [
        {
          ...emptyPlanItem(),
          chapterIdx: 0,
          goalIdx: 0,
          goalDetailIdx: 0,
          policyIdx: 0,
          subPolicyIdx: -1,
          subLevelIdx: -1,
        },
        {
          ...emptyPlanItem(),
          chapterIdx: 0,
          goalIdx: 0,
          goalDetailIdx: 0,
          policyIdx: 0,
          subPolicyIdx: -1,
          subLevelIdx: -1,
        },
      ],
      actionTitle: "Multi",
      department: "",
      actionDetails: "<p>x</p>",
      primaryContact: emptyContact(),
      alternateContact: emptyContact(),
    });
    expect(r.compPlanItems).toHaveLength(2);
    expect(r.compPlanItems[0].policy?.number).toBe("1.1.1");
    expect(r.compPlanItems[1].policy?.number).toBe("1.1.1");
  });
});
