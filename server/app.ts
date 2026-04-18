import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { resolveOwner } from "./authContext.js";
import { renderSubmissionPdfBuffer } from "./buildSubmissionPdf.js";
import { openDatabase } from "./db/database.js";
import { parseCreateBody, parsePatchBody } from "./submissionPatchBody.js";
import {
  deleteSubmission,
  getById,
  insertSubmission,
  listByOwner,
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
    allowedHeaders: ["Content-Type", "X-User-Oid", "X-User-Email", "Authorization"],
  });

  app.get("/api/health", async () => ({
    ok: true,
    version: pkg.version,
    workflow: "shelved",
    submissions: "sqlite",
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
      return insertSubmission(db, owner.ownerKey, snapshot, status);
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

  return app;
}
