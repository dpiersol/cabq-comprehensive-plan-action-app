import { describe, expect, it } from "vitest";
import { planSearchEntryToTarget } from "./entryToTarget";
import type { PlanSearchEntry } from "./types";

describe("planSearchEntryToTarget", () => {
  it("maps indices for jump", () => {
    const e: PlanSearchEntry = {
      id: "x",
      level: "policy",
      chapterIdx: 2,
      goalIdx: 3,
      goalDetailIdx: 1,
      policyIdx: 0,
      subPolicyIdx: -1,
      subLevelIdx: -1,
      breadcrumb: "b",
      label: "l",
      searchBlob: "s",
    };
    expect(planSearchEntryToTarget(e)).toEqual({
      chapterIdx: 2,
      goalIdx: 3,
      goalDetailIdx: 1,
      policyIdx: 0,
      subPolicyIdx: -1,
      subLevelIdx: -1,
    });
  });
});
