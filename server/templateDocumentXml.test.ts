import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { preprocessTemplateDocumentXml } from "./templateDocumentXml.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("preprocessTemplateDocumentXml", () => {
  it("normalizes split placeholders in comp-plan-print-template.docx", () => {
    const buf = readFileSync(join(__dirname, "templates/comp-plan-print-template.docx"));
    const zip = new PizZip(buf);
    const xml = zip.file("word/document.xml")?.asText();
    if (typeof xml !== "string") throw new Error("missing document.xml");
    const out = preprocessTemplateDocumentXml(xml);
    expect(out).toContain("{legislationDescription}");
    expect(out).toContain("{howDoesLegislationFurtherPolicies}");
    expect(out).toContain("{currentDate}");
    expect(out).not.toMatch(/\{Legislation <\/w:t>/);
  });
});
