import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { renderSubmissionPdfBuffer } from "./buildSubmissionPdf.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8")) as { version: string };

/** API for the CABQ Comprehensive Plan Action app (user form + PDF generation). */
export function buildServer() {
  const app = Fastify({ logger: process.env.VITEST ? false : true });
  app.register(cors, { origin: true });

  app.get("/api/health", async () => ({
    ok: true,
    version: pkg.version,
    workflow: "shelved",
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

  return app;
}
