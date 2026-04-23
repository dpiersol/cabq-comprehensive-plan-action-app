/**
 * Shared sortable column header for data tables (user submissions + admin list).
 * Uses `.saved-table-sort` from `index.css` (loaded by both SPA bundles).
 */
export function SortableTh<T extends string>({
  label,
  colKey,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  colKey: T;
  sortKey: T;
  sortDir: "asc" | "desc";
  onSort: (k: T) => void;
}) {
  const active = sortKey === colKey;
  return (
    <th scope="col" aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className="saved-table-sort" onClick={() => onSort(colKey)}>
        <span className="saved-table-sort-label">{label}</span>
        {active ? (
          <span className="saved-table-sort-indicator" aria-hidden>
            {sortDir === "asc" ? " ▲" : " ▼"}
          </span>
        ) : (
          <span className="saved-table-sort-hint" aria-hidden>
            {" "}
            ↕
          </span>
        )}
      </button>
    </th>
  );
}
