export type UserRole = "submitter" | "planning" | "city_council" | "admin_stub";

/** Where the item sits for inbox routing */
export type Queue = "planning" | "city_council" | "fi_department" | "complete";

/** Business status labels */
export type WorkflowStatus =
  | "PlanningReview"
  | "CityCouncilReview"
  | "FurtherInformationDepartment"
  | "FurtherInformationPlanning"
  | "ReviewCompleted"
  | "Complete";

export type FiRequestedBy = "planning" | "city_council";

export type WorkflowAction =
  | "send_to_city_council"
  | "request_dept_info"
  | "complete"
  | "review_completed"
  | "request_dept_info_council"
  | "further_information_planning"
  | "dept_submit_response";

export interface WorkflowState {
  currentQueue: Queue;
  status: WorkflowStatus;
  fiRequestedBy: FiRequestedBy | null;
}

export interface TransitionPayload {
  /** Instructions for department (Planning or Council request dept info) */
  workflowComments?: string;
  /** Council → Planning (Further Information Planning) */
  councilToPlanningComments?: string;
}
