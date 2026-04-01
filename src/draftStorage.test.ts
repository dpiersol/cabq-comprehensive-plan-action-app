import { describe, expect, it } from "vitest";
import {
  emptyDraft,
  normalizeDraft,
  parseDraftJson,
} from "./draftStorage";
import { emptyContact } from "./contacts";
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
                  subPolicies: [
                    { letter: "a", text: "t" },
                    {
                      letter: "b",
                      text: "u",
                      subLevels: [{ roman: "i.", description: "one" }],
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

describe("draftStorage", () => {
  it("parseDraftJson handles non-object", () => {
    expect(parseDraftJson(null)).toEqual(emptyDraft());
  });

  it("parseDraftJson maps legacy title to actionTitle", () => {
    const d = parseDraftJson({
      chapterIdx: -1,
      title: "Legacy name",
    });
    expect(d.actionTitle).toBe("Legacy name");
  });

  it("normalizeDraft resets when chapter out of range but keeps action text", () => {
    const d = normalizeDraft(minimalPlan, {
      ...emptyDraft(),
      chapterIdx: 99,
      actionDetails: "keep me",
    });
    expect(d.chapterIdx).toBe(-1);
    expect(d.actionDetails).toBe("keep me");
  });

  it("normalizeDraft preserves valid full path including sub-level", () => {
    const d = normalizeDraft(minimalPlan, {
      chapterIdx: 0,
      goalIdx: 0,
      goalDetailIdx: 0,
      policyIdx: 0,
      subPolicyIdx: 1,
      subLevelIdx: 0,
      actionDetails: "x",
      actionTitle: "",
      department: "",
      primaryContact: emptyContact(),
      alternateContact: emptyContact(),
      attachments: [],
    });
    expect(d.subLevelIdx).toBe(0);
    expect(d.subPolicyIdx).toBe(1);
  });

  it("normalizeDraft clears sub-level when sub-policy has no levels", () => {
    const d = normalizeDraft(minimalPlan, {
      chapterIdx: 0,
      goalIdx: 0,
      goalDetailIdx: 0,
      policyIdx: 0,
      subPolicyIdx: 0,
      subLevelIdx: 0,
      actionDetails: "",
      actionTitle: "",
      department: "",
      primaryContact: emptyContact(),
      alternateContact: emptyContact(),
      attachments: [],
    });
    expect(d.subLevelIdx).toBe(-1);
  });
});
