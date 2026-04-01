/** Normalize any plan field for concatenation into search blobs (null/undefined-safe). */
export function blobPart(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

/** Lowercased, single-spaced blob from parts (Excel / JSON may use nulls). */
export function mergeSearchParts(...parts: unknown[]): string {
  return parts
    .map(blobPart)
    .filter((s) => s.length > 0)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
