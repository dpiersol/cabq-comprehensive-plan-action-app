import type { Queue, TransitionPayload, UserRole, WorkflowAction, WorkflowState } from "./types.js";

export interface TransitionResult {
  next: WorkflowState;
  /** Generate new FI token when entering FI Department */
  generateFiToken: boolean;
  /** Clear council comments after Planning has seen them (optional UX; keep in DB for audit) */
}

export function initialSubmitState(): WorkflowState {
  return {
    currentQueue: "planning",
    status: "PlanningReview",
    fiRequestedBy: null,
  };
}

/** Which role "owns" the inbox for this queue (for default button sets). */
export function queueOwnerRole(queue: Queue): UserRole | "dept" | null {
  if (queue === "planning") return "planning";
  if (queue === "city_council") return "city_council";
  if (queue === "fi_department") return "dept";
  return null;
}

/**
 * Non-Planning users may only act when their role matches the queue owner
 * (except submitter — no workflow transitions from app except submit).
 */
export function canAccessQueue(actor: UserRole, queue: Queue): boolean {
  if (actor === "planning") return true;
  if (queue === "complete") return actor === "admin_stub";
  const owner = queueOwnerRole(queue);
  if (owner === "dept") return false; /* dept uses token */
  return owner === actor;
}

/**
 * Apply a workflow transition. Returns error message if invalid.
 */
export function applyTransition(
  current: WorkflowState,
  action: WorkflowAction,
  payload: TransitionPayload,
): { ok: true; result: TransitionResult } | { ok: false; error: string } {
  const { currentQueue, status, fiRequestedBy } = current;

  const needDeptComments = (c: string | undefined) => {
    const t = (c ?? "").trim();
    if (t.length < 3) return "Comments are required (at least 3 characters).";
    return null;
  };

  const needCouncilToPlanning = (c: string | undefined) => {
    const t = (c ?? "").trim();
    if (t.length < 3) return "Comments for Planning are required (at least 3 characters).";
    return null;
  };

  switch (action) {
    case "send_to_city_council": {
      if (currentQueue !== "planning") return { ok: false, error: "Invalid state for this action." };
      if (status !== "PlanningReview" && status !== "ReviewCompleted") {
        return { ok: false, error: "Send to City Council only from Planning review states." };
      }
      return {
        ok: true,
        result: {
          next: {
            currentQueue: "city_council",
            status: "CityCouncilReview",
            fiRequestedBy,
          },
          generateFiToken: false,
        },
      };
    }
    case "request_dept_info": {
      if (currentQueue !== "planning") return { ok: false, error: "Only Planning can request department information from this queue." };
      const err = needDeptComments(payload.workflowComments);
      if (err) return { ok: false, error: err };
      return {
        ok: true,
        result: {
          next: {
            currentQueue: "fi_department",
            status: "FurtherInformationDepartment",
            fiRequestedBy: "planning",
          },
          generateFiToken: true,
        },
      };
    }
    case "complete": {
      if (currentQueue !== "planning") return { ok: false, error: "Complete is only available from Planning queue." };
      return {
        ok: true,
        result: {
          next: { currentQueue: "complete", status: "Complete", fiRequestedBy: null },
          generateFiToken: false,
        },
      };
    }
    case "review_completed": {
      if (currentQueue !== "city_council" || status !== "CityCouncilReview") {
        return { ok: false, error: "Review Completed is only valid in City Council review." };
      }
      return {
        ok: true,
        result: {
          next: {
            currentQueue: "planning",
            status: "ReviewCompleted",
            fiRequestedBy,
          },
          generateFiToken: false,
        },
      };
    }
    case "request_dept_info_council": {
      if (currentQueue !== "city_council" || status !== "CityCouncilReview") {
        return { ok: false, error: "This action is only valid in City Council review." };
      }
      const err = needDeptComments(payload.workflowComments);
      if (err) return { ok: false, error: err };
      return {
        ok: true,
        result: {
          next: {
            currentQueue: "fi_department",
            status: "FurtherInformationDepartment",
            fiRequestedBy: "city_council",
          },
          generateFiToken: true,
        },
      };
    }
    case "further_information_planning": {
      if (currentQueue !== "city_council" || status !== "CityCouncilReview") {
        return { ok: false, error: "Further Information Planning is only valid in City Council review." };
      }
      const err = needCouncilToPlanning(payload.councilToPlanningComments);
      if (err) return { ok: false, error: err };
      return {
        ok: true,
        result: {
          next: {
            currentQueue: "planning",
            status: "PlanningReview",
            fiRequestedBy,
          },
          generateFiToken: false,
        },
      };
    }
    case "dept_submit_response": {
      if (currentQueue !== "fi_department" || status !== "FurtherInformationDepartment") {
        return { ok: false, error: "Department response is only valid in Further Information (Department)." };
      }
      if (!fiRequestedBy) return { ok: false, error: "Missing FI request source." };
      if (fiRequestedBy === "planning") {
        return {
          ok: true,
          result: {
            next: {
              currentQueue: "planning",
              status: "PlanningReview",
              fiRequestedBy: null,
            },
            generateFiToken: false,
          },
        };
      }
      return {
        ok: true,
        result: {
          next: {
            currentQueue: "city_council",
            status: "CityCouncilReview",
            fiRequestedBy: null,
          },
          generateFiToken: false,
        },
      };
    }
    default:
      return { ok: false, error: "Unknown action." };
  }
}

/** Actions shown for the current queue/status for the owning role (Planning uses this by impersonating queue). */
export function actionsForState(state: WorkflowState): WorkflowAction[] {
  const { currentQueue, status } = state;
  if (currentQueue === "complete") return [];

  if (currentQueue === "planning") {
    if (status === "Complete") return [];
    return ["send_to_city_council", "request_dept_info", "complete"];
  }
  if (currentQueue === "city_council" && status === "CityCouncilReview") {
    return ["review_completed", "request_dept_info_council", "further_information_planning"];
  }
  if (currentQueue === "fi_department" && status === "FurtherInformationDepartment") {
    return ["dept_submit_response"];
  }
  return [];
}
