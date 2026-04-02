import cors from "@fastify/cors";
import Fastify from "fastify";

/** Minimal API while workflow is shelved (see `archive/workflow-shelved/`). */
export function buildServer() {
  const app = Fastify({ logger: process.env.VITEST ? false : true });
  app.register(cors, { origin: true });
  app.get("/api/health", async () => ({
    ok: true,
    version: "0.11.2",
    workflow: "shelved",
  }));
  return app;
}
