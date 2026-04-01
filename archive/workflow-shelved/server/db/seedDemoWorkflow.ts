import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { AppDb } from "./client.js";
import { submissions, workflowEvents } from "./schema.js";
import type { FiRequestedBy, Queue, WorkflowStatus } from "../workflow/types.js";

/** Prefix for demo rows — safe to delete and re-seed. */
export const DEMO_ID_PREFIX = "demo-";

/**
 * One submission per (queue, status, FI source) combination, × `perStep` copies.
 * Covers every inbox the Workflow tab can show.
 */
const DEMO_STEPS: {
  slug: string;
  currentQueue: Queue;
  status: WorkflowStatus;
  fiRequestedBy: FiRequestedBy | null;
  workflowComments: string | null;
  councilToPlanningComments: string | null;
  needsFiToken: boolean;
}[] = [
  {
    slug: "planning-review",
    currentQueue: "planning",
    status: "PlanningReview",
    fiRequestedBy: null,
    workflowComments: null,
    councilToPlanningComments: null,
    needsFiToken: false,
  },
  {
    slug: "planning-after-council",
    currentQueue: "planning",
    status: "ReviewCompleted",
    fiRequestedBy: null,
    workflowComments: null,
    councilToPlanningComments: null,
    needsFiToken: false,
  },
  {
    slug: "city-council",
    currentQueue: "city_council",
    status: "CityCouncilReview",
    fiRequestedBy: null,
    workflowComments: null,
    councilToPlanningComments: null,
    needsFiToken: false,
  },
  {
    slug: "fi-from-planning",
    currentQueue: "fi_department",
    status: "FurtherInformationDepartment",
    fiRequestedBy: "planning",
    workflowComments:
      "Demo: Planning requested further information. Please upload the traffic study and cross-sections.",
    councilToPlanningComments: null,
    needsFiToken: true,
  },
  {
    slug: "fi-from-council",
    currentQueue: "fi_department",
    status: "FurtherInformationDepartment",
    fiRequestedBy: "city_council",
    workflowComments:
      "Demo: City Council requested further information. Please provide site photos and a summary memo.",
    councilToPlanningComments: null,
    needsFiToken: true,
  },
  {
    slug: "complete",
    currentQueue: "complete",
    status: "Complete",
    fiRequestedBy: null,
    workflowComments: null,
    councilToPlanningComments: null,
    needsFiToken: false,
  },
];

export const DEMO_SUBMISSIONS_PER_STEP = 5;

function demoSnapshot(stepLabel: string, index: number): Record<string, unknown> {
  const n = index + 1;
  return {
    chapterIdx: 0,
    goalIdx: 0,
    goalDetailIdx: 0,
    policyIdx: 0,
    subPolicyIdx: -1,
    subLevelIdx: -1,
    actionDetails: `<p><strong>Demo preview</strong> — ${stepLabel} #${n}. This text is sample departmental action content for UI review.</p>`,
    actionTitle: `Demo · ${stepLabel} #${n}`,
    department: "Planning Department",
    primaryContact: {
      name: "Alex Demo",
      role: "Planner",
      email: "alex.demo@cabq.gov",
      phone: "(505) 555-0100",
    },
    alternateContact: { name: "", role: "", email: "", phone: "" },
    attachments: [],
  };
}

/** Remove previous demo seed rows (ids starting with {@link DEMO_ID_PREFIX}). */
export function clearDemoSubmissions(sqlite: Database.Database): void {
  sqlite.exec(`
    DELETE FROM workflow_events WHERE submission_id LIKE '${DEMO_ID_PREFIX}%';
    DELETE FROM notifications WHERE submission_id LIKE '${DEMO_ID_PREFIX}%';
    DELETE FROM submissions WHERE id LIKE '${DEMO_ID_PREFIX}%';
  `);
}

/**
 * Insert demo submissions: {@link DEMO_SUBMISSIONS_PER_STEP} per workflow step
 * ({@link DEMO_STEPS.length} steps → 30 rows by default).
 */
export function runDemoWorkflowSeed(
  sqlite: Database.Database,
  db: AppDb,
  options?: { perStep?: number; clearFirst?: boolean },
): { inserted: number } {
  const perStep = options?.perStep ?? DEMO_SUBMISSIONS_PER_STEP;
  const clearFirst = options?.clearFirst ?? true;
  if (clearFirst) clearDemoSubmissions(sqlite);

  let inserted = 0;
  const baseTime = Date.now();

  for (const step of DEMO_STEPS) {
    for (let i = 0; i < perStep; i++) {
      const id = `${DEMO_ID_PREFIX}${step.slug}-${i}`;
      const fiToken = step.needsFiToken ? randomUUID() : null;
      const snap = demoSnapshot(step.slug.replace(/-/g, " "), i);
      const createdAt = new Date(baseTime - inserted * 60_000);
      const updatedAt = createdAt;

      db.insert(submissions).values({
        id,
        snapshotJson: JSON.stringify(snap),
        status: step.status,
        currentQueue: step.currentQueue,
        fiRequestedBy: step.fiRequestedBy,
        workflowComments: step.workflowComments,
        councilToPlanningComments: step.councilToPlanningComments,
        fiAccessToken: fiToken,
        createdByUserId: "user-submitter-1",
        createdAt,
        updatedByUserId: "user-planning-1",
        updatedAt,
      });

      db.insert(workflowEvents).values({
        id: randomUUID(),
        submissionId: id,
        fromStatus: "—",
        toStatus: step.status,
        action: "demo_seed",
        actorUserId: "user-planning-1",
        payloadJson: JSON.stringify({ step: step.slug, index: i }),
        createdAt,
      });

      inserted += 1;
    }
  }

  return { inserted };
}
