/**
 * Client-side attachment rules. A production service must re-validate on upload
 * (content inspection, antivirus, size quotas). Never execute uploaded files in the browser.
 */

/** Per file; keeps localStorage exports usable. */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/** Total count cap per action record. */
export const MAX_ATTACHMENT_COUNT = 12;

const BLOCKED_EXTENSIONS = new Set([
  "exe",
  "dll",
  "bat",
  "cmd",
  "com",
  "msi",
  "scr",
  "pif",
  "app",
  "deb",
  "rpm",
  "sh",
  "bash",
  "zsh",
  "ps1",
  "psm1",
  "vbs",
  "vbe",
  "js",
  "jse",
  "wsf",
  "wsh",
  "msc",
  "msp",
  "jar",
  "hta",
  "cpl",
  "scf",
  "lnk",
  "inf",
  "reg",
  "sql",
  "sqlite",
  "php",
  "asp",
  "aspx",
  "jsp",
  "py",
  "pyc",
  "pyo",
  "rb",
  "pl",
  "cgi",
  "bin",
  "run",
  "dmg",
  "iso",
]);

/** Extension → acceptable MIME families (subset; browsers may report octet-stream). */
const ALLOWED_MAP: Record<string, readonly string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
  ],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  txt: ["text/plain"],
  rtf: ["application/rtf", "text/rtf"],
  csv: ["text/csv", "text/plain", "application/csv"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  gif: ["image/gif"],
  webp: ["image/webp"],
  bmp: ["image/bmp"],
  tif: ["image/tiff"],
  tiff: ["image/tiff"],
  heic: ["image/heic", "image/heif"],
  ico: ["image/x-icon", "image/vnd.microsoft.icon"],
};

export function getExtension(fileName: string): string {
  const base = fileName.replace(/^.*[/\\]/, "").trim();
  const last = base.lastIndexOf(".");
  if (last < 0 || last === base.length - 1) return "";
  return base.slice(last + 1).toLowerCase();
}

export interface ValidateFileResult {
  ok: boolean;
  reason?: string;
}

/** Validate a single File before read. Extension allowlist + blocklist + MIME cross-check. */
export function validateAttachmentFile(file: File): ValidateFileResult {
  if (!file || file.size === 0) {
    return { ok: false, reason: "File is empty." };
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, reason: `File exceeds ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB limit.` };
  }

  const name = file.name || "file";
  if (name.length > 255) {
    return { ok: false, reason: "File name is too long." };
  }
  if (/[\\/]/.test(name)) {
    return { ok: false, reason: "Invalid file name." };
  }

  const ext = getExtension(name);
  if (!ext) {
    return { ok: false, reason: "File must have an extension." };
  }
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { ok: false, reason: `File type “.${ext}” is not allowed for security reasons.` };
  }

  const allowedMimes = ALLOWED_MAP[ext];
  if (!allowedMimes) {
    return {
      ok: false,
      reason: `Only business documents and images are allowed (got .${ext}).`,
    };
  }

  const mime = (file.type || "").toLowerCase().split(";")[0].trim();
  if (mime && mime !== "application/octet-stream") {
    const mimeOk = allowedMimes.some((m) => m === mime);
    if (!mimeOk && ext !== "csv") {
      // CSV is often text/plain; docx is zip — allow octet-stream fallback only when ext matches
      if (mime !== "application/octet-stream") {
        return { ok: false, reason: "File content type does not match the extension." };
      }
    }
  }

  return { ok: true };
}

export function attachmentAcceptAttribute(): string {
  return [
    ...Object.keys(ALLOWED_MAP).map((e) => `.${e}`),
    ...Array.from(new Set(Object.values(ALLOWED_MAP).flat())).join(","),
  ]
    .filter(Boolean)
    .join(",");
}
