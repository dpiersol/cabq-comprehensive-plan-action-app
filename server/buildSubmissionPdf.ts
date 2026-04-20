import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import Docxtemplater from "docxtemplater";
import PDFDocument from "pdfkit";
import PizZip from "pizzip";
import { splitLabel } from "./splitLabel.js";
import { preprocessTemplateDocumentXml } from "./templateDocumentXml.js";

const require = createRequire(import.meta.url);
const libreofficeConvert = require("libreoffice-convert") as {
  convert: (
    document: Buffer,
    format: string,
    filter: string | undefined,
    callback: (err: Error | null, result: Buffer) => void,
  ) => void;
};
const convertWithLibreOffice = promisify(libreofficeConvert.convert);

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Bundled copy (optional). User can also rely on Desktop path or COMP_PLAN_DOCX_TEMPLATE. */
const BUNDLED_TEMPLATE = join(__dirname, "templates", "comp-plan-print-template.docx");

/** Default filename on the user Desktop (matches common project handoff). */
const DESKTOP_TEMPLATE_NAME = "comp plan print template.docx";

export interface SubmissionPdfFields {
  currentDate: string;
  legislationTitle: string;
  chapter: string;
  goal: string;
  policy: string;
  legislationDescription: string;
  howDoesLegislationFurtherPolicies: string;
}

function parsePayload(p: unknown): SubmissionPdfFields {
  if (!p || typeof p !== "object") throw new Error("Invalid JSON body");
  const o = p as Record<string, unknown>;
  const str = (k: string) => (typeof o[k] === "string" ? o[k] : "");
  return {
    currentDate: str("currentDate"),
    legislationTitle: str("legislationTitle"),
    chapter: str("chapter"),
    goal: str("goal"),
    policy: str("policy"),
    legislationDescription: str("legislationDescription"),
    howDoesLegislationFurtherPolicies: str("howDoesLegislationFurtherPolicies"),
  };
}

/** Maps API fields to tags used after `preprocessTemplateDocumentXml` (camelCase). */
export function buildDocxMergeData(fields: SubmissionPdfFields): Record<string, string> {
  const ch = splitLabel(fields.chapter);
  const g = splitLabel(fields.goal);
  const p = splitLabel(fields.policy);
  return {
    currentDate: fields.currentDate,
    legislationTitle: fields.legislationTitle,
    chapterNumber: ch.head,
    chapterDescription: ch.tail,
    goal: g.head,
    goalDescription: g.tail,
    policy: p.head,
    policyDescription: p.tail,
    legislationDescription: fields.legislationDescription,
    howDoesLegislationFurtherPolicies: fields.howDoesLegislationFurtherPolicies,
  };
}

export function resolveDocxTemplatePath(): string | null {
  const env = process.env.COMP_PLAN_DOCX_TEMPLATE?.trim();
  if (env && existsSync(env)) return env;
  if (existsSync(BUNDLED_TEMPLATE)) return BUNDLED_TEMPLATE;
  const desktop = join(homedir(), "Desktop", DESKTOP_TEMPLATE_NAME);
  if (existsSync(desktop)) return desktop;
  return null;
}

function usePdfKitOnly(): boolean {
  return Boolean(process.env.VITEST) || process.env.COMP_PLAN_PDF_SIMPLE === "1";
}

export function fillDocxFromTemplate(templatePath: string, fields: SubmissionPdfFields): Buffer {
  const input = readFileSync(templatePath);
  const zip = new PizZip(input);
  const xmlPath = "word/document.xml";
  const raw = zip.file(xmlPath)?.asText();
  if (typeof raw !== "string") throw new Error("Template is missing word/document.xml");
  zip.file(xmlPath, preprocessTemplateDocumentXml(raw));
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });
  doc.setData(buildDocxMergeData(fields));
  doc.render();
  const out = doc.getZip().generate({ type: "nodebuffer" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}

export async function convertDocxBufferToPdf(docx: Buffer): Promise<Buffer> {
  const pdf = await convertWithLibreOffice(docx, ".pdf", undefined);
  return Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
}

/**
 * PDFKit fallback when no template is available, LibreOffice is missing, or tests run (VITEST).
 *
 * Layout mirrors the on-screen Print document (`.print-doc` in `src/index.css`) so
 * **Download PDF** and **Print document** produce the same looking document:
 *   ┌──────────────────────────────────────────────┐
 *   │ Comprehensive Plan Action            {date}  │
 *   │ ────────────────────────────────────────────  │
 *   │ Legislation Title: ...                       │
 *   │ Chapter: ...                                 │
 *   │ Goal: ...                                    │
 *   │ Policy: ...                                  │
 *   │                                              │
 *   │ Legislation Description:                     │
 *   │ ...                                          │
 *   │                                              │
 *   │ How does this legislation further the        │
 *   │ policies selected?                           │
 *   │ ...                                          │
 *   └──────────────────────────────────────────────┘
 */
export function renderPdfKitFallback(fields: SubmissionPdfFields): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 54, size: "LETTER" });
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const title = "Comprehensive Plan Action";
    const titleFontSize = 16;
    const bodyFontSize = 11;
    const leftMargin = doc.page.margins.left;
    const rightMargin = doc.page.margins.right;
    const contentWidth = doc.page.width - leftMargin - rightMargin;

    doc.font("Helvetica-Bold").fontSize(titleFontSize);
    const titleHeight = doc.heightOfString(title, { width: contentWidth });
    const titleY = doc.y;
    doc.text(title, leftMargin, titleY, { width: contentWidth });
    doc
      .font("Helvetica")
      .fontSize(bodyFontSize)
      .text(fields.currentDate, leftMargin, titleY + (titleHeight - bodyFontSize) / 2, {
        width: contentWidth,
        align: "right",
      });
    doc.moveDown(0.5);

    const ruleY = doc.y;
    doc
      .moveTo(leftMargin, ruleY)
      .lineTo(leftMargin + contentWidth, ruleY)
      .lineWidth(0.75)
      .strokeColor("#94a3b8")
      .stroke();
    doc.moveDown(0.8);

    const inlineRow = (label: string, value: string) => {
      doc.font("Helvetica-Bold").fontSize(bodyFontSize).text(`${label} `, { continued: true });
      doc.font("Helvetica").fontSize(bodyFontSize).text(value || "—");
      doc.moveDown(0.45);
    };

    const blockRow = (heading: string, value: string) => {
      doc.font("Helvetica-Bold").fontSize(bodyFontSize).text(heading);
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(bodyFontSize).text(value || "—", {
        align: "left",
        lineGap: 2,
      });
      doc.moveDown(0.8);
    };

    inlineRow("Legislation Title:", fields.legislationTitle);
    inlineRow("Chapter:", fields.chapter);
    inlineRow("Goal:", fields.goal);
    inlineRow("Policy:", fields.policy);
    doc.moveDown(0.3);

    blockRow("Legislation Description:", fields.legislationDescription);
    blockRow(
      "How does this legislation further the policies selected?",
      fields.howDoesLegislationFurtherPolicies,
    );

    doc.end();
  });
}

function parsePayloadLenient(body: unknown): SubmissionPdfFields {
  try {
    return parsePayload(body);
  } catch {
    const d = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return {
      currentDate: d,
      legislationTitle: "—",
      chapter: "—",
      goal: "—",
      policy: "—",
      legislationDescription: "—",
      howDoesLegislationFurtherPolicies: "—",
    };
  }
}

async function renderSubmissionPdfInner(body: unknown): Promise<Buffer> {
  const fields = parsePayloadLenient(body);

  if (usePdfKitOnly()) {
    return renderPdfKitFallback(fields);
  }

  const templatePath = resolveDocxTemplatePath();
  if (!templatePath) {
    return renderPdfKitFallback(fields);
  }

  try {
    const docx = fillDocxFromTemplate(templatePath, fields);
    return await convertDocxBufferToPdf(docx);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(
      `[comp-plan-pdf] Template or LibreOffice conversion failed (${msg}). Using PDFKit fallback. Install LibreOffice and ensure the template uses docxtemplater tags (see server/templates/README.md).`,
    );
    return renderPdfKitFallback(fields);
  }
}

/**
 * Merge `fields` into the Word template, then convert to PDF with LibreOffice (headless).
 * Falls back to PDFKit when tests set VITEST, when COMP_PLAN_PDF_SIMPLE=1, when no template file exists,
 * or when LibreOffice conversion fails (with a console warning).
 *
 * Does not throw — always returns PDF bytes so the API can respond with 200 when the route is reached.
 */
export async function renderSubmissionPdfBuffer(body: unknown): Promise<Buffer> {
  try {
    return await renderSubmissionPdfInner(body);
  } catch (e) {
    console.error("[comp-plan-pdf] Unexpected error; using PDFKit fallback.", e);
    return renderPdfKitFallback(parsePayloadLenient(body));
  }
}
