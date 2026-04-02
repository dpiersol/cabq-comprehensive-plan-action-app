/**
 * Split combined labels like `1 — Chapter title` (from the app) into number/title parts
 * for templates that use `{Chapter Number}` and `{Chapter Description}` separately.
 */
export function splitLabel(s: string): { head: string; tail: string } {
  const t = s.trim();
  const seps = [" — ", " – ", " - "];
  for (const sep of seps) {
    const i = t.indexOf(sep);
    if (i >= 0) {
      return { head: t.slice(0, i).trim(), tail: t.slice(i + sep.length).trim() };
    }
  }
  return { head: t, tail: "" };
}
