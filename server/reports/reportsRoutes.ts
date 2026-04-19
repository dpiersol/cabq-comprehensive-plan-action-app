/**
 * HTTP routes for the Admin → Security → Reports area.
 * All endpoints are admin-only (isAdminFor). Responses are plain JSON.
 */

import type { FastifyInstance } from "fastify";
import type Database from "better-sqlite3";

import { isAdminFor } from "../adminAuth.js";
import { resolveOwner } from "../authContext.js";
import { getEffectiveAuthConfig } from "../authConfigRepo.js";
import { getSubmissionsOverview, getUserActivity } from "./reportsRepo.js";

export function registerReportsRoutes(app: FastifyInstance, db: Database.Database): void {
  // GET /api/admin/reports/submissions-overview?weeks=13
  app.get("/api/admin/reports/submissions-overview", async (req, reply) => {
    const owner = await resolveOwner(req, db);
    if (!owner) return reply.code(401).send({ error: "unauthorized" });
    if (!isAdminFor(db, owner)) return reply.code(403).send({ error: "forbidden" });

    const q = req.query as { weeks?: string } | undefined;
    const weeksRaw = q?.weeks ? Number.parseInt(q.weeks, 10) : 13;
    const weeks = Number.isFinite(weeksRaw)
      ? Math.min(Math.max(weeksRaw, 4), 52)
      : 13;

    return getSubmissionsOverview(db, { weeks });
  });

  // GET /api/admin/reports/user-activity
  app.get("/api/admin/reports/user-activity", async (req, reply) => {
    const owner = await resolveOwner(req, db);
    if (!owner) return reply.code(401).send({ error: "unauthorized" });
    if (!isAdminFor(db, owner)) return reply.code(403).send({ error: "forbidden" });

    const cfg = getEffectiveAuthConfig(db);
    return getUserActivity(db, cfg.adminRoleNames);
  });
}
