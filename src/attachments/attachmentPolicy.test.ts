import { describe, expect, it } from "vitest";
import {
  getExtension,
  MAX_ATTACHMENT_BYTES,
  validateAttachmentFile,
} from "./attachmentPolicy";

function makeFile(name: string, size: number, type: string): File {
  const b = new Uint8Array(Math.max(1, size));
  return new File([b], name, { type });
}

describe("attachmentPolicy", () => {
  it("accepts pdf", () => {
    const f = makeFile("memo.pdf", 100, "application/pdf");
    expect(validateAttachmentFile(f).ok).toBe(true);
  });

  it("accepts png image", () => {
    const f = makeFile("photo.png", 500, "image/png");
    expect(validateAttachmentFile(f).ok).toBe(true);
  });

  it("rejects exe", () => {
    const f = makeFile("run.exe", 100, "application/octet-stream");
    expect(validateAttachmentFile(f).ok).toBe(false);
  });

  it("rejects sql", () => {
    const f = makeFile("dump.sql", 50, "application/sql");
    expect(validateAttachmentFile(f).ok).toBe(false);
  });

  it("rejects bat", () => {
    const f = makeFile("x.bat", 10, "text/plain");
    expect(validateAttachmentFile(f).ok).toBe(false);
  });

  it("rejects oversize", () => {
    const f = makeFile("big.pdf", MAX_ATTACHMENT_BYTES + 1, "application/pdf");
    expect(validateAttachmentFile(f).ok).toBe(false);
  });

  it("rejects empty file", () => {
    const f = new File([], "empty.pdf", { type: "application/pdf" });
    expect(validateAttachmentFile(f).ok).toBe(false);
  });

  it("rejects unknown extension", () => {
    const f = makeFile("hack.xyz", 10, "application/octet-stream");
    expect(validateAttachmentFile(f).ok).toBe(false);
  });

  it("getExtension uses last segment", () => {
    expect(getExtension("report.final.pdf")).toBe("pdf");
  });
});
