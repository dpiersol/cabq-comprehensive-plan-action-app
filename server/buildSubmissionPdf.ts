import PDFDocument from "pdfkit";

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

/**
 * Generates a Comprehensive Plan PDF using the same logical fields as the Word template placeholders.
 */
export async function renderSubmissionPdfBuffer(body: unknown): Promise<Buffer> {
  const fields = parsePayload(body);
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
