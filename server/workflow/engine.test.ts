import { describe, expect, it } from "vitest";
import {
  actionsForState,
  applyTransition,
  canAccessQueue,
  initialSubmitState,
} from "./engine.js";

describe("initialSubmitState", () => {
  it("starts in Planning / PlanningReview", () => {
    expect(initialSubmitState()).toEqual({
      currentQueue: "planning",
      status: "PlanningReview",
      fiRequestedBy: null,
    });
  });
});

describe("applyTransition", () => {
  it("send_to_city_council from planning", () => {
    const r = applyTransition(initialSubmitState(), "send_to_city_council", {});
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.next.currentQueue).toBe("city_council");
      expect(r.result.next.status).toBe("CityCouncilReview");
    }
  });

  it("request_dept_info requires comments", () => {
    const r = applyTransition(initialSubmitState(), "request_dept_info", {});
    expect(r.ok).toBe(false);
  });

  it("request_dept_info with comments goes to FI Department", () => {
    const r = applyTransition(initialSubmitState(), "request_dept_info", {
      workflowComments: "Please upload the map.",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.next.currentQueue).toBe("fi_department");
      expect(r.result.next.status).toBe("FurtherInformationDepartment");
      expect(r.result.next.fiRequestedBy).toBe("planning");
      expect(r.result.generateFiToken).toBe(true);
    }
  });

  it("further_information_planning from council", () => {
    const councilState = {
      currentQueue: "city_council" as const,
      status: "CityCouncilReview" as const,
      fiRequestedBy: null,
    };
    const bad = applyTransition(councilState, "further_information_planning", {});
    expect(bad.ok).toBe(false);

    const good = applyTransition(councilState, "further_information_planning", {
      councilToPlanningComments: "Please review zoning alignment.",
    });
    expect(good.ok).toBe(true);
    if (good.ok) {
      expect(good.result.next.currentQueue).toBe("planning");
      expect(good.result.next.status).toBe("PlanningReview");
    }
  });

  it("dept_submit_response routes by fiRequestedBy", () => {
    const fi = {
      currentQueue: "fi_department" as const,
      status: "FurtherInformationDepartment" as const,
      fiRequestedBy: "planning" as const,
    };
    const toP = applyTransition(fi, "dept_submit_response", {});
    expect(toP.ok).toBe(true);
    if (toP.ok) {
      expect(toP.result.next.currentQueue).toBe("planning");
      expect(toP.result.next.status).toBe("PlanningReview");
    }

    const fi2 = {
      currentQueue: "fi_department" as const,
      status: "FurtherInformationDepartment" as const,
      fiRequestedBy: "city_council" as const,
    };
    const toC = applyTransition(fi2, "dept_submit_response", {});
    expect(toC.ok).toBe(true);
    if (toC.ok) {
      expect(toC.result.next.currentQueue).toBe("city_council");
      expect(toC.result.next.status).toBe("CityCouncilReview");
    }
  });
});

describe("canAccessQueue", () => {
  it("planning can access all queues", () => {
    expect(canAccessQueue("planning", "city_council")).toBe(true);
    expect(canAccessQueue("planning", "planning")).toBe(true);
  });

  it("council only city_council", () => {
    expect(canAccessQueue("city_council", "city_council")).toBe(true);
    expect(canAccessQueue("city_council", "planning")).toBe(false);
  });
});

describe("actionsForState", () => {
  it("lists planning actions", () => {
    const a = actionsForState(initialSubmitState());
    expect(a).toContain("send_to_city_council");
    expect(a).toContain("complete");
  });

  it("lists council actions", () => {
    const a = actionsForState({
      currentQueue: "city_council",
      status: "CityCouncilReview",
      fiRequestedBy: null,
    });
    expect(a).toContain("review_completed");
    expect(a).toContain("further_information_planning");
  });
});
