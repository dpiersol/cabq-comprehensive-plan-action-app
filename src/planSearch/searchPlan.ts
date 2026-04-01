import type { PlanSearchEntry, PlanSearchLevel } from "./types";

/** Order used when interleaving one hit per level (breadth across the hierarchy). */
export const SEARCH_LEVEL_ORDER: PlanSearchLevel[] = [
  "chapter",
  "goal",
  "goalDetail",
  "policy",
  "subPolicy",
  "subLevel",
];

function tokenize(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** Sum of inverse positions for each token’s first hit (higher = better). */
export function tokenScore(searchBlob: string, tokens: string[]): number {
  let s = 0;
  for (const t of tokens) {
    const i = searchBlob.indexOf(t);
    if (i < 0) return -1;
    s += 1 / (1 + i);
  }
  return s;
}

type Scored = { entry: PlanSearchEntry; ts: number };

function emptyBuckets(): Record<PlanSearchLevel, Scored[]> {
  return {
    chapter: [],
    goal: [],
    goalDetail: [],
    policy: [],
    subPolicy: [],
    subLevel: [],
  };
}

/**
 * AND search: every token must appear as a substring of `searchBlob`.
 * Results are **interleaved by hierarchy level** (chapter → … → sub-level) so higher-level
 * matches are not buried under thousands of deeper rows that share the same ancestor text.
 * Within each level, better token placement (earlier in the blob) ranks higher.
 */
export function searchPlan(
  query: string,
  entries: readonly PlanSearchEntry[],
  limit = 25,
): PlanSearchEntry[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const buckets = emptyBuckets();

  for (const entry of entries) {
    const ts = tokenScore(entry.searchBlob, tokens);
    if (ts < 0) continue;
    buckets[entry.level].push({ entry, ts });
  }

  for (const level of SEARCH_LEVEL_ORDER) {
    buckets[level].sort((a, b) => b.ts - a.ts);
  }

  const out: PlanSearchEntry[] = [];
  let round = 0;
  while (out.length < limit) {
    let progressed = false;
    for (const level of SEARCH_LEVEL_ORDER) {
      const row = buckets[level][round];
      if (row) {
        out.push(row.entry);
        progressed = true;
        if (out.length >= limit) break;
      }
    }
    if (!progressed) break;
    round++;
  }

  return out;
}
