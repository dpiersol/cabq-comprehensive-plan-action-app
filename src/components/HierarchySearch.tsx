import { useEffect, useId, useMemo, useState } from "react";
import type { PlanData } from "../types";
import { buildPlanSearchIndex } from "../planSearch/buildPlanSearchIndex";
import { planSearchEntryToTarget } from "../planSearch/entryToTarget";
import { searchPlan } from "../planSearch/searchPlan";
import type { HierarchyJumpTarget } from "../planSearch/types";

export interface HierarchySearchProps {
  data: PlanData;
  onJump: (target: HierarchyJumpTarget) => void;
}

const DEBOUNCE_MS = 280;
const MAX_RESULTS = 20;

export function HierarchySearch({ data, onJump }: HierarchySearchProps) {
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listId = `${baseId}-list`;

  const entries = useMemo(() => buildPlanSearchIndex(data), [data]);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  const results = useMemo(
    () => searchPlan(debounced.trim(), entries, MAX_RESULTS),
    [debounced, entries],
  );

  const showList = debounced.trim().length > 0 && results.length > 0;

  return (
    <div className="hierarchy-search no-print" role="search" aria-label="Search Comprehensive Plan">
      <div className="field hierarchy-search-field">
        <label htmlFor={inputId}>Search Comprehensive Plan</label>
        <input
          id={inputId}
          type="search"
          className="search-input-large"
          placeholder="Search by keyword, policy number, or phrase…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={showList ? listId : undefined}
          aria-expanded={showList}
        />
        <p className="hint">
          Searches chapter, goal, goal detail, policy, sub-policy, and sub-level text. All words must
          appear in the same row’s combined text. Results mix levels so chapters and policies are not
          buried under deeper rows—pick a row to jump the dropdowns to that spot.
        </p>
      </div>

      {debounced.trim().length > 0 && results.length === 0 && (
        <p className="search-empty" role="status">
          No matches. Try fewer words or a policy number (e.g. 4.1.1).
        </p>
      )}

      {showList && (
        <ul id={listId} className="search-results" role="listbox" aria-label="Search results">
          {results.map((hit) => (
            <li key={hit.id} role="none">
              <button
                type="button"
                className="search-hit"
                role="option"
                title={hit.breadcrumb}
                onClick={() => {
                  onJump(planSearchEntryToTarget(hit));
                  setQuery("");
                  setDebounced("");
                }}
              >
                <span className="search-hit-level">{formatLevel(hit.level)}</span>
                <span className="search-hit-label">{hit.label}</span>
                <span className="search-hit-crumb">{hit.breadcrumb}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatLevel(level: string): string {
  switch (level) {
    case "chapter":
      return "Chapter";
    case "goal":
      return "Goal";
    case "goalDetail":
      return "Goal detail";
    case "policy":
      return "Policy";
    case "subPolicy":
      return "Sub-policy";
    case "subLevel":
      return "Sub-level";
    default:
      return level;
  }
}
