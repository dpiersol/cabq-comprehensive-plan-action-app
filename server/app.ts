import cors from "@fastify/cors";
import Fastify, { type FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { eq, desc } from "drizzle-orm";
import { initDb } from "./db/client.js";
import { seedUsers } from "./db/seed.js";
import { runDemoWorkflowSeed } from "./db/seedDemoWorkflow.js";
import { submissions, workflowEvents, users } from "./db/schema.js";
import {
  actionsForState,
  applyTransition,
  canAccessQueue,
  initialSubmitState,
} from "./workflow/engine.js";
import type { FiRequestedBy, Queue, UserRole, WorkflowAction, WorkflowState } from "./workflow/types.js";
import { draftSnapshotSchema } from "./validation/snapshot.js";
import type { ValidatedSnapshot } from "./validation/snapshot.js";
import {
  extractContactEmails,
  insertNotification,
  notifyPlanningStaff,
} from "./services/notifications.js";
import { buildActionDocx } from "./services/docx.js";

declare module "fastify" {
  interface FastifyRequest {
    authUser?: { userId: string; role: UserRole };
  }
}

const sessions = new Map<string, { userId: string; role: UserRole }>();

function rowToState(row: {
  currentQueue: string;
  status: string;
  fiRequestedBy: string | null;
}): WorkflowState {
  return {
    currentQueue: row.currentQueue as Queue,
    status: row.status as WorkflowState["status"],
    fiRequestedBy: (row.fiRequestedBy as FiRequestedBy | null) ?? null,
  };
}

function canReadSubmission(role: UserRole, queue: Queue): boolean {
  if (role === "planning" || role === "admin_stub") return true;
  return canAccessQueue(role, queue);
}

export function buildServer() {
  const { sqlite, db } = initDb();
  seedUsers(sqlite);
  const skipDemoSeed =
    process.env.VITEST === "true" ||
    process.env.NODE_ENV === "test" ||
    process.env.VITEST_WORKER_ID !== undefined;
  if (process.env.WORKFLOW_DEMO_SEED === "1" && !skipDemoSeed) {
    const { inserted } = runDemoWorkflowSeed(sqlite, db);
    console.info(`[WORKFLOW_DEMO_SEED] Inserted ${inserted} demo submissions.`);
  }

  const app = Fastify({ logger: process.env.VITEST ? false : true });
  app.register(cors, { origin: true });

  app.get("/api/health", async () => ({ ok: true, version: "0.9.0" }));

  app.post("/api/auth/login", async (req, reply) => {
    const body = (req.body ?? {}) as { userId?: string };
    if (!body.userId || typeof body.userId !== "string") {
      return reply.code(400).send({ error: "userId required" });
    }
    const u = db.select().from(users).where(eq(users.id, body.userId)).get();
    if (!u) return reply.code(404).send({ error: "User not found" });
    const token = randomUUID() + randomUUID();
    sessions.set(token, { userId: u.id, role: u.role as UserRole });
    return { token, user: { id: u.id, displayName: u.displayName, role: u.role } };
  });

  app.get("/api/auth/me", async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return reply.code(401).send({ error: "Unauthorized" });
    const token = auth.slice(7);
    const s = sessions.get(token);
    if (!s) return reply.code(401).send({ error: "Unauthorized" });
    const u = db.select().from(users).where(eq(users.id, s.userId)).get();
    if (!u) return reply.code(401).send({ error: "Unauthorized" });
    return { user: { id: u.id, displayName: u.displayName, role: u.role, email: u.email } };
  });

  /** Create submission (optional auth for audit). */
  app.post("/api/submissions", async (req, reply) => {
    const body = (req.body ?? {}) as { snapshot?: unknown };
    const parsed = draftSnapshotSchema.safeParse(body.snapshot);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid snapshot", details: parsed.error.flatten() });
    }
    const snap = parsed.data;
    const id = randomUUID();
    const now = new Date();
    const auth = req.headers.authorization;
    let createdBy: string | null = null;
    if (auth?.startsWith("Bearer ")) {
      const s = sessions.get(auth.slice(7));
      if (s) createdBy = s.userId;
    }
    const initial = initialSubmitState();
    db.insert(submissions).values({
      id,
      snapshotJson: JSON.stringify(snap),
      status: initial.status,
      currentQueue: initial.currentQueue,
      fiRequestedBy: null,
      workflowComments: null,
      councilToPlanningComments: null,
      fiAccessToken: null,
      createdByUserId: createdBy,
      createdAt: now,
      updatedByUserId: createdBy,
      updatedAt: now,
    });
    db.insert(workflowEvents).values({
      id: randomUUID(),
      submissionId: id,
      fromStatus: "—",
      toStatus: initial.status,
      action: "submit",
      actorUserId: createdBy,
      payloadJson: null,
      createdAt: now,
    });
    return { id, status: initial.status, currentQueue: initial.currentQueue };
  });

  app.get("/api/users", async () => {
    const rows = db.select().from(users).all();
    return rows.map((u) => ({ id: u.id, displayName: u.displayName, role: u.role }));
  });

  app.get(
    "/api/submissions",
    async (req: FastifyRequest, reply) => {
      const auth = req.headers.authorization;
      if (!auth?.startsWith("Bearer ")) return reply.code(401).send({ error: "Unauthorized" });
      const s = sessions.get(auth.slice(7));
      if (!s) return reply.code(401).send({ error: "Unauthorized" });
      const role = s.role as UserRole;

      let rows;
      if (role === "planning" || role === "admin_stub") {
        rows = db.select().from(submissions).orderBy(desc(submissions.updatedAt)).all();
      } else if (role === "city_council") {
        rows = db
          .select()
          .from(submissions)
          .where(eq(submissions.currentQueue, "city_council"))
          .orderBy(desc(submissions.updatedAt))
          .all();
      } else {
        return reply.code(403).send({ error: "Forbidden" });
      }

      return rows.map((r) => ({
        id: r.id,
        status: r.status,
        currentQueue: r.currentQueue,
        actionTitle: safeParseTitle(r.snapshotJson),
        updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
      }));
    },
  );

  app.get("/api/submissions/:id", async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return reply.code(401).send({ error: "Unauthorized" });
    const s = sessions.get(auth.slice(7));
    if (!s) return reply.code(401).send({ error: "Unauthorized" });
    const id = (req.params as { id: string }).id;
    const row = db.select().from(submissions).where(eq(submissions.id, id)).get();
    if (!row) return reply.code(404).send({ error: "Not found" });
    if (!canReadSubmission(s.role as UserRole, row.currentQueue as Queue)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const snap = JSON.parse(row.snapshotJson) as ValidatedSnapshot;
    const state = rowToState(row);
    const actions =
      s.role === "planning" || s.role === "admin_stub"
        ? actionsForState(state)
        : canAccessQueue(s.role as UserRole, row.currentQueue as Queue)
          ? actionsForState(state)
          : [];
    return {
      id: row.id,
      status: row.status,
      currentQueue: row.currentQueue,
      fiRequestedBy: row.fiRequestedBy,
      fiAccessToken: row.fiAccessToken,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
      snapshot: snap,
      availableActions: actions,
      workflowComments: row.workflowComments,
      councilToPlanningComments: row.councilToPlanningComments,
    };
  });

  app.patch("/api/submissions/:id", async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return reply.code(401).send({ error: "Unauthorized" });
    const s = sessions.get(auth.slice(7));
    if (!s) return reply.code(401).send({ error: "Unauthorized" });
    if (s.role !== "planning" && s.role !== "admin_stub") {
      return reply.code(403).send({ error: "Only Planning may update submissions." });
    }
    const id = (req.params as { id: string }).id;
    const row = db.select().from(submissions).where(eq(submissions.id, id)).get();
    if (!row) return reply.code(404).send({ error: "Not found" });
    const body = (req.body ?? {}) as { snapshot?: unknown };
    const parsed = draftSnapshotSchema.safeParse(body.snapshot);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid snapshot" });
    }
    const now = new Date();
    db.update(submissions)
      .set({
        snapshotJson: JSON.stringify(parsed.data),
        updatedByUserId: s.userId,
        updatedAt: now,
      })
      .where(eq(submissions.id, id))
      .run();
    return { ok: true };
  });

  app.post("/api/submissions/:id/transition", async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return reply.code(401).send({ error: "Unauthorized" });
    const sess = sessions.get(auth.slice(7));
    if (!sess) return reply.code(401).send({ error: "Unauthorized" });
    const role = sess.role as UserRole;
    const id = (req.params as { id: string }).id;
    const row = db.select().from(submissions).where(eq(submissions.id, id)).get();
    if (!row) return reply.code(404).send({ error: "Not found" });

    const state = rowToState(row);
    const body = (req.body ?? {}) as {
      action?: WorkflowAction;
      workflowComments?: string;
      councilToPlanningComments?: string;
    };
    if (!body.action) return reply.code(400).send({ error: "action required" });

    const allowed = actionsForState(state);
    if (!allowed.includes(body.action)) {
      return reply.code(400).send({ error: "Action not allowed for current state", allowed });
    }

    if (role !== "planning" && role !== "admin_stub") {
      if (!canAccessQueue(role, row.currentQueue as Queue)) {
        return reply.code(403).send({ error: "Wrong queue for your role" });
      }
    }

    const result = applyTransition(state, body.action, {
      workflowComments: body.workflowComments,
      councilToPlanningComments: body.councilToPlanningComments,
    });
    if (!result.ok) return reply.code(400).send({ error: result.error });

    const next = result.result.next;
    const now = new Date();
    let fiToken = row.fiAccessToken;
    if (result.result.generateFiToken) {
      fiToken = randomUUID();
    }
    if (body.action === "dept_submit_response") {
      fiToken = null;
    }

    let workflowComments = row.workflowComments;
    let councilToPlanningComments = row.councilToPlanningComments;
    if (body.action === "request_dept_info" || body.action === "request_dept_info_council") {
      workflowComments = body.workflowComments ?? null;
    }
    if (body.action === "further_information_planning") {
      councilToPlanningComments = body.councilToPlanningComments ?? null;
    }

    db.update(submissions)
      .set({
        status: next.status,
        currentQueue: next.currentQueue,
        fiRequestedBy: next.fiRequestedBy,
        fiAccessToken: fiToken,
        workflowComments,
        councilToPlanningComments,
        updatedByUserId: sess.userId,
        updatedAt: now,
      })
      .where(eq(submissions.id, id))
      .run();

    db.insert(workflowEvents).values({
      id: randomUUID(),
      submissionId: id,
      fromStatus: row.status,
      toStatus: next.status,
      action: body.action,
      actorUserId: sess.userId,
      payloadJson: JSON.stringify({
        workflowComments: body.workflowComments,
        councilToPlanningComments: body.councilToPlanningComments,
      }),
      createdAt: now,
    });

    const snap = JSON.parse(row.snapshotJson) as ValidatedSnapshot;
    runTransitionSideEffects({
      sqlite,
      db,
      action: body.action,
      submissionId: id,
      snapshot: snap,
      workflowComments: workflowComments ?? undefined,
      councilToPlanningComments: councilToPlanningComments ?? undefined,
      fiAccessToken: fiToken,
    });

    return { ok: true, status: next.status, currentQueue: next.currentQueue };
  });

  app.get("/api/submissions/:id/document", async (req, reply) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return reply.code(401).send({ error: "Unauthorized" });
    const s = sessions.get(auth.slice(7));
    if (!s) return reply.code(401).send({ error: "Unauthorized" });
    const id = (req.params as { id: string }).id;
    const row = db.select().from(submissions).where(eq(submissions.id, id)).get();
    if (!row) return reply.code(404).send({ error: "Not found" });
    if (row.status !== "Complete") return reply.code(400).send({ error: "Not complete" });
    if (!canReadSubmission(s.role as UserRole, row.currentQueue as Queue)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
    const snap = JSON.parse(row.snapshotJson) as ValidatedSnapshot;
    const buf = await buildActionDocx(snap.actionTitle, snap.actionDetails);
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    reply.header("Content-Disposition", `attachment; filename="action-${id.slice(0, 8)}.docx"`);
    return reply.send(buf);
  });

  /** Department FI response (token auth). */
  app.get("/api/fi/:token", async (req, reply) => {
    const token = (req.params as { token: string }).token;
    const row = db.select().from(submissions).where(eq(submissions.fiAccessToken, token)).get();
    if (!row) return reply.code(404).send({ error: "Not found" });
    if (row.currentQueue !== "fi_department") return reply.code(400).send({ error: "Invalid state" });
    const snap = JSON.parse(row.snapshotJson) as ValidatedSnapshot;
    return {
      id: row.id,
      snapshot: snap,
      workflowComments: row.workflowComments,
      status: row.status,
    };
  });

  app.post("/api/fi/:token/respond", async (req, reply) => {
    const token = (req.params as { token: string }).token;
    const row = db.select().from(submissions).where(eq(submissions.fiAccessToken, token)).get();
    if (!row) return reply.code(404).send({ error: "Not found" });
    const state = rowToState(row);
    if (state.currentQueue !== "fi_department" || state.status !== "FurtherInformationDepartment") {
      return reply.code(400).send({ error: "Invalid state" });
    }
    const body = (req.body ?? {}) as { snapshot?: unknown };
    const parsed = draftSnapshotSchema.safeParse(body.snapshot);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid snapshot" });

    const tr = applyTransition(state, "dept_submit_response", {});
    if (!tr.ok) return reply.code(400).send({ error: tr.error });
    const next = tr.result.next;
    const now = new Date();
    db.update(submissions)
      .set({
        snapshotJson: JSON.stringify(parsed.data),
        status: next.status,
        currentQueue: next.currentQueue,
        fiRequestedBy: next.fiRequestedBy,
        fiAccessToken: null,
        updatedAt: now,
        updatedByUserId: null,
      })
      .where(eq(submissions.id, row.id))
      .run();
    db.insert(workflowEvents).values({
      id: randomUUID(),
      submissionId: row.id,
      fromStatus: row.status,
      toStatus: next.status,
      action: "dept_submit_response",
      actorUserId: null,
      payloadJson: null,
      createdAt: now,
    });
    return { ok: true, status: next.status, currentQueue: next.currentQueue };
  });

  return app;
}

function safeParseTitle(snapshotJson: string): string {
  try {
    const o = JSON.parse(snapshotJson) as { actionTitle?: string };
    return o.actionTitle?.trim() || "(untitled)";
  } catch {
    return "(untitled)";
  }
}

function runTransitionSideEffects(ctx: {
  sqlite: import("better-sqlite3").Database;
  db: import("./db/client.js").AppDb;
  action: WorkflowAction;
  submissionId: string;
  snapshot: ValidatedSnapshot;
  workflowComments?: string;
  councilToPlanningComments?: string;
  fiAccessToken: string | null;
}) {
  const { sqlite, db, action, submissionId, snapshot, workflowComments, councilToPlanningComments } =
    ctx;
  const emails = extractContactEmails(snapshot);

  if (action === "request_dept_info" || action === "request_dept_info_council") {
    const addrs = [emails.primary, emails.alternate].filter(Boolean) as string[];
    const body = `More information is needed for your comprehensive plan action submission.\n\nInstructions:\n${workflowComments ?? ""}\n\nIf you received a link, use it to respond with attachments.`;
    insertNotification(db, {
      submissionId,
      toAddresses: addrs.length ? addrs : [emails.primary],
      subject: "Further information requested (CABQ Comprehensive Plan Action)",
      body,
    });
  }

  if (action === "review_completed") {
    notifyPlanningStaff(sqlite, db, submissionId, "Council review completed", "A submission has been marked Review Completed and returned to Planning.");
  }

  if (action === "further_information_planning") {
    notifyPlanningStaff(
      sqlite,
      db,
      submissionId,
      "City Council requests Planning input",
      `City Council comments for Planning:\n\n${councilToPlanningComments ?? ""}`,
    );
  }

  if (action === "complete") {
    const addrs = [emails.primary, emails.alternate].filter(Boolean) as string[];
    insertNotification(db, {
      submissionId,
      toAddresses: addrs.length ? addrs : [emails.primary],
      subject: "Action completed (CABQ Comprehensive Plan Action)",
      body: `Your submission "${snapshot.actionTitle}" has been marked complete. A summary document may be available from staff.`,
    });
  }
}

