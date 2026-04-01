/**
 * Plain text from HTML for validation and character counts (rich text editor output).
 */
export function plainTextFromHtml(html: string): string {
  if (!html || typeof html !== "string") return "";
  const trimmed = html.trim();
  if (!trimmed) return "";
  if (typeof document !== "undefined") {
    const d = document.createElement("div");
    d.innerHTML = trimmed;
    const t = d.textContent ?? "";
    return t.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }
  return trimmed
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/g, " ")
    .replace(/&#32;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
