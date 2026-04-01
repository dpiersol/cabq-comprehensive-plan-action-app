/**
 * Plain text from HTML (Node) — mirrors the non-DOM branch in `src/htmlUtils.ts` for DOCX export.
 */
export function plainTextFromHtml(html: string): string {
  if (!html || typeof html !== "string") return "";
  const trimmed = html.trim();
  if (!trimmed) return "";
  return trimmed
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/g, " ")
    .replace(/&#32;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
