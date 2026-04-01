import { Document, Packer, Paragraph, TextRun } from "docx";

export async function buildActionDocx(actionTitle: string, actionDescription: string): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "CABQ Comprehensive Plan — Action summary", bold: true, size: 32 }),
            ],
          }),
          new Paragraph({ children: [new TextRun("")] }),
          new Paragraph({
            children: [new TextRun({ text: "Action title", bold: true })],
          }),
          new Paragraph({
            children: [new TextRun(actionTitle || "(none)")],
          }),
          new Paragraph({ children: [new TextRun("")] }),
          new Paragraph({
            children: [new TextRun({ text: "Action description", bold: true })],
          }),
          new Paragraph({
            children: [new TextRun(actionDescription || "(none)")],
          }),
          new Paragraph({ children: [new TextRun("")] }),
          new Paragraph({
            children: [
              new TextRun({
                text: "This is a placeholder document for v0.8.0. Replace with your formatted template later.",
                italics: true,
              }),
            ],
          }),
        ],
      },
    ],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}
