import { describe, expect, it } from "vitest";
import type { PlanData } from "./types";
import type { DraftSnapshot } from "./draftStorage";
import { emptyPlanItem } from "./draftStorage";
import { emptyContact } from "./contacts";
import {
  validateDraftForExport,
  validateDraftForSave,
  validatePrimaryContact,
} from "./validation";

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

const validPrimary = {
  name: "Jane Planner",
  role: "Planner",
  email: "jane.planner@cabq.gov",
  phone: "(505) 555-0100",
};

function baseSnap(over: Partial<DraftSnapshot> = {}): DraftSnapshot {
  return {
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
    ],
    actionDetails: "<p>1234567890abcd</p>",
    actionTitle: "Valid title here",
    department: "",
    primaryContact: { ...emptyContact(), ...validPrimary },
    alternateContact: emptyContact(),
    ...over,
  };
}

describe("validateDraftForSave", () => {
  it("passes for complete selection and meta", () => {
    const r = validateDraftForSave(plan, baseSnap());
    expect(r.ok).toBe(true);
  });

  it("fails when action title too short", () => {
    const r = validateDraftForSave(plan, baseSnap({ actionTitle: "ab" }));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.toLowerCase().includes("action title"))).toBe(true);
  });

  it("fails when action text too short", () => {
    const r = validateDraftForSave(plan, baseSnap({ actionDetails: "<p>short</p>" }));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.toLowerCase().includes("action description"))).toBe(true);
  });

  it("fails when primary contact incomplete", () => {
    const r = validateDraftForSave(
      plan,
      baseSnap({
        primaryContact: { ...emptyContact(), ...validPrimary, email: "not-an-email" },
      }),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.toLowerCase().includes("email"))).toBe(true);
  });

  it("fails when second plan item missing policy", () => {
    const r = validateDraftForSave(
      plan,
      baseSnap({
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
          emptyPlanItem(),
        ],
      }),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("Plan item 2"))).toBe(true);
  });
});

describe("validatePrimaryContact", () => {
  it("returns errors for empty block", () => {
    const e = validatePrimaryContact(emptyContact());
    expect(e.length).toBeGreaterThan(0);
  });

  it("returns no errors for valid primary", () => {
    expect(validatePrimaryContact({ ...emptyContact(), ...validPrimary })).toEqual([]);
  });
});

describe("validateDraftForExport", () => {
  it("fails without action title when hierarchy and primary contact complete", () => {
    const r = validateDraftForExport(
      plan,
      baseSnap({ actionTitle: "", actionDetails: "<p>1234567890abcd</p>" }),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.toLowerCase().includes("action title"))).toBe(true);
  });

  it("fails when action details exceed max length (plain text)", () => {
    const r = validateDraftForExport(
      plan,
      baseSnap({ actionDetails: `<p>${"x".repeat(2501)}</p>` }),
    );
    expect(r.ok).toBe(false);
  });
});
