import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { isAdmin } from "./adminAuth.js";
import { resolveOwner } from "./authContext.js";
import { bootstrapAdminIfNeeded } from "./bootstrapAdmin.js";
import { renderSubmissionPdfBuffer } from "./buildSubmissionPdf.js";
import { openDatabase } from "./db/database.js";
import { registerLocalAuthRoutes } from "./localAuthRoutes.js";
import { localSessionConfigured } from "./localSessionJwt.js";
import { parseCreateBody, parsePatchBody } from "./submissionPatchBody.js";
import {
  deleteSubmission,
  getAny,
  getById,
  insertSubmission,
  listAll,
  listByOwner,
  patchAny,
  patchSubmission,
} from "./submissionsRepo.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8")) as { version: string };

export interface BuildServerOptions {
  db?: Database.Database;
}

/** API for the CABQ Comprehensive Plan Action app (user form + PDF + persisted submissions). */
export function buildServer(opts?: BuildServerOptions) {
  const db = opts?.db ?? openDatabase();
  const app = Fastify({ logger: process.env.VITEST ? false : true });
  app.register(cors, {
    origin: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "X-User-Oid",
      "X-User-Email",
      "X-User-Roles",
      "Authorization",
    ],
  });
  app.register(rateLimit, {
    global: false,
    max: 10,
    timeWindow: "1 minute",
  });

  app.get("/api/health", async () => ({
    ok: true,
    version: pkg.version,
    workflow: "shelved",
    submissions: "sqlite",
    localAuth: localSessionConfigured(),
  }));

  app.post("/api/submissions/pdf", async (req, reply) => {
    try {
      const buf = await renderSubmissionPdfBuffer(req.body);
      return reply.type("application/pdf").send(buf);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bad request";
      return reply.code(400).send({ error: msg });
    }
  });

  app.get("/api/submissions", async (req, reply) => {
    const owner = await resolveOwner(req);
    if (!owner) {
      return reply.code(401).send({
        error: "Authentication required (Bearer token or permitted identity headers)",
      });
    }
    return listByOwner(db, owner.ownerKey);
  });

  app.get<{ Params: { id: string } }>("/api/submissions/:id", async (req, reply) => {
    const owner = await resolveOwner(req);
    if (!owner) {
      return reply.code(401).send({
        error: "Authentication required (Bearer token or permitted identity headers)",
      });
    }
    const row = getById(db, owner.ownerKey, req.params.id);
    if (!row) return reply.code(404).send({ error: "Not found" });
    return row;
  });

  app.post("/api/submissions", async (req, reply) => {
    const owner = await resolveOwner(req);
    if (!owner) {
      return reply.code(401).send({
        error: "Authentication required (Bearer token or permitted identity headers)",
      });
    }
    try {
      const { snapshot, status } = parseCreateBody(req.body);
      return insertSubmission(db, owner.ownerKey, snapshot, status, owner.email);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bad request";
      return reply.code(400).send({ error: msg });
    }
  });

  app.patch<{ Params: { id: string } }>("/api/submissions/:id", async (req, reply) => {
    const owner = await resolveOwner(req);
    if (!owner) {
      return reply.code(401).send({
        error: "Authentication required (Bearer token or permitted identity headers)",
      });
    }
    try {
      const patch = parsePatchBody(req.body);
      const row = patchSubmission(db, owner.ownerKey, req.params.id, patch);
      if (!row) return reply.code(404).send({ error: "Not found" });
      return row;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bad request";
      return reply.code(400).send({ error: msg });
    }
  });

  app.delete<{ Params: { id: string } }>("/api/submissions/:id", async (req, reply) => {
    const owner = await resolveOwner(req);
    if (!owner) {
      return reply.code(401).send({
        error: "Authentication required (Bearer token or permitted identity headers)",
      });
    }
    const result = deleteSubmission(db, owner.ownerKey, req.params.id);
    if (result === "not_found") return reply.code(404).send({ error: "Not found" });
    if (result === "not_draft") {
      return reply.code(409).send({ error: "Only draft records can be deleted. Reopen for editing first." });
    }
    return { ok: true };
  });

  /** Admin endpoints — same auth as user routes plus an admin role / email check. */
  app.get("/api/admin/submissions", async (req, reply) => {
    const owner = await resolveOwner(req);
    if (!owner) return reply.code(401).send({ error: "Authentication required" });
    if (!isAdmin(owner)) return reply.code(403).send({ error: "Admin role required" });
    return listAll(db);
  });

  app.get<{ Params: { id: string } }>("/api/admin/submissions/:id", async (req, reply) => {
    const owner = await resolveOwner(req);
    if (!owner) return reply.code(401).send({ error: "Authentication required" });
    if (!isAdmin(owner)) return reply.code(403).send({ error: "Admin role required" });
    const row = getAny(db, req.params.id);
    if (!row) return reply.code(404).send({ error: "Not found" });
    return row;
  });

  app.patch<{ Params: { id: string } }>("/api/admin/submissions/:id", async (req, reply) => {
    const owner = await resolveOwner(req);
    if (!owner) return reply.code(401).send({ error: "Authentication required" });
    if (!isAdmin(owner)) return reply.code(403).send({ error: "Admin role required" });
    try {
      const patch = parsePatchBody(req.body);
      const row = patchAny(db, req.params.id, patch);
      if (!row) return reply.code(404).send({ error: "Not found" });
      return row;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bad request";
      return reply.code(400).send({ error: msg });
    }
  });

  registerLocalAuthRoutes(app, db);

  // Bootstrap initial admin (no-op in tests or when env vars not set).
  if (!process.env.VITEST) {
    void bootstrapAdminIfNeeded(db).catch((err) => {
      app.log.warn({ err }, "bootstrap admin failed");
    });
  }

  return app;
}
