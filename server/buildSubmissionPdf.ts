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
 */
export function renderPdfKitFallback(fields: SubmissionPdfFields): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 54, size: "LETTER" });
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).font("Helvetica-Bold").text("Comprehensive Plan — Legislation documentation", {
      align: "center",
    });
    doc.moveDown(1.2);
    doc.font("Helvetica").fontSize(11);

    const sections: { placeholder: string; value: string }[] = [
      { placeholder: "{current date}", value: fields.currentDate },
      { placeholder: "{legislation title}", value: fields.legislationTitle },
      { placeholder: "{chapter}", value: fields.chapter },
      { placeholder: "{goal}", value: fields.goal },
      { placeholder: "{policy}", value: fields.policy },
      { placeholder: "{legislation description}", value: fields.legislationDescription },
      {
        placeholder: "{How does this legislation further the policies selected?}",
        value: fields.howDoesLegislationFurtherPolicies,
      },
    ];

    for (const { placeholder, value } of sections) {
      doc.font("Helvetica-Bold").fontSize(11).text(placeholder);
      doc.font("Helvetica").fontSize(11).text(value, { align: "left" });
      doc.moveDown(1);
    }

    doc.end();
  });
}

/**
 * Merge `fields` into the Word template, then convert to PDF with LibreOffice (headless).
 * Falls back to PDFKit when tests set VITEST, when COMP_PLAN_PDF_SIMPLE=1, when no template file exists,
 * or when LibreOffice conversion fails (with a console warning).
 */
export async function renderSubmissionPdfBuffer(body: unknown): Promise<Buffer> {
  const fields = parsePayload(body);

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
