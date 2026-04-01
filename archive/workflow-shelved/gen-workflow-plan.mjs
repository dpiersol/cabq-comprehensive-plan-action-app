/**
 * Generates workflow_plan.docx at repo root (run: node scripts/gen-workflow-plan.mjs).
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Document, Packer, Paragraph, TextRun } from "docx";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "workflow_plan.docx");

const doc = new Document({
  sections: [
    {
      children: [
        new Paragraph({
          children: [new TextRun({ text: "CABQ Comprehensive Plan Action — Workflow plan (v0.8.0)", bold: true, size: 32 })],
        }),
        new Paragraph({ children: [new TextRun("")] }),
        new Paragraph({
          children: [new TextRun({ text: "1. Purpose", bold: true })],
        }),
        new Paragraph({
          children: [
            new TextRun(
              "This document describes the v0.8.0 workflow: SQLite repository, Fastify API, mock staff login, Planning full access, City Council queue, Further Information Department (token link), notifications (persisted + console), and rough Word export on Complete.",
            ),
          ],
        }),
        new Paragraph({ children: [new TextRun("")] }),
        new Paragraph({
          children: [new TextRun({ text: "2. Swim lane (summary)", bold: true })],
        }),
        new Paragraph({
          children: [
            new TextRun(
              "Submitter → Submit → Planning (PlanningReview). Planning → City Council | Request Dept Info (FI) | Complete. City Council → Review Completed | Request Dept Info | Further Information Planning (comments to Planning). Department contact → FI token page → Submit back to Planning or Council per fi_requested_by.",
            ),
          ],
        }),
        new Paragraph({ children: [new TextRun("")] }),
        new Paragraph({
          children: [new TextRun({ text: "3. Security", bold: true })],
        }),
        new Paragraph({
          children: [
            new TextRun(
              "HTTPS in production; mock auth for dev only; role checks on transitions; Planning bypass for queue scope; audit workflow_events; validate uploads server-side in future; secrets in .env.",
            ),
          ],
        }),
        new Paragraph({ children: [new TextRun("")] }),
        new Paragraph({
          children: [new TextRun({ text: "4. Database migration path", bold: true })],
        }),
        new Paragraph({
          children: [
            new TextRun(
              "Development uses SQLite file data/workflow.db (or WORKFLOW_DB_PATH). Production: point Drizzle to SQL Server or Oracle via provider and connection string; keep business logic in workflow/engine.ts.",
            ),
          ],
        }),
        new Paragraph({ children: [new TextRun("")] }),
        new Paragraph({
          children: [new TextRun({ text: "5. Runbook", bold: true })],
        }),
        new Paragraph({
          children: [
            new TextRun(
              "npm run dev:all — Vite + API. Seed users: planning@local.dev, council@local.dev, submitter@local.dev (see server/db/seed.ts). Workflow tab: staff login. Composer: Submit to workflow.",
            ),
          ],
        }),
      ],
    },
  ],
});

const buf = await Packer.toBuffer(doc);
writeFileSync(outPath, buf);
console.log("Wrote", outPath);
