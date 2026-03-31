import type { PlanSearchEntry } from "./types";
import { specificityRank } from "./buildPlanSearchIndex";

function tokenize(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** Sum of inverse positions for each token’s first hit (higher = better). */
function tokenScore(searchBlob: string, tokens: string[]): number {
  let s = 0;
  for (const t of tokens) {
    const i = searchBlob.indexOf(t);
    if (i < 0) return -1;
    s += 1 / (1 + i);
  }
  return s;
}

/**
 * AND search: every token must appear as a substring of `searchBlob`.
 * Results sorted by relevance (token positions + hierarchy specificity).
 */
export function searchPlan(
  query: string,
  entries: readonly PlanSearchEntry[],
  limit = 25,
): PlanSearchEntry[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const scored: { entry: PlanSearchEntry; score: number }[] = [];

  for (const entry of entries) {
    const ts = tokenScore(entry.searchBlob, tokens);
    if (ts < 0) continue;
    const spec = specificityRank(entry.level);
    const combined = ts * 10 + spec;
    scored.push({ entry, score: combined });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entry.breadcrumb.localeCompare(b.entry.breadcrumb);
  });

  return scored.slice(0, limit).map((x) => x.entry);
}
