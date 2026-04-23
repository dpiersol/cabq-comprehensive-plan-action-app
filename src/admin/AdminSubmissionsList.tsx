import { useMemo, useState } from "react";
import type { PlanData } from "../types";
import type { SavedAction } from "../savedActionsStore";
import { resolvePlanItem } from "../planSelection";
import { chapterLabel, policyLabel } from "../labels";
import { plainTextFromHtml } from "../htmlUtils";
import { submissionStatusLabel } from "../submissionStatus";
import { isAdminSavedAction } from "./AdminApp";
import { SortableTh } from "../components/SortableTh";

interface Props {
  plan: PlanData;
  actions: SavedAction[];
  /** When true, show the submission owner column (server-backed view). */
  showOwner?: boolean;
  onOpenSubmission: (id: string) => void;
}

type AdminSortKey =
  | "record"
  | "title"
  | "department"
  | "primaryContact"
  | "owner"
  | "policy"
  | "status"
  | "updated";

function policiesJoin(plan: PlanData, a: SavedAction): string {
  const items = a.snapshot.planItems?.length ? a.snapshot.planItems : [];
  const policies = items
    .map((row) => {
      const sel = resolvePlanItem(plan, row);
      return sel.policy ? policyLabel(sel.policy) : "";
    })
    .filter(Boolean);
  return policies.join(" ").toLowerCase();
}

function compareAdmin(plan: PlanData, a: SavedAction, b: SavedAction, key: AdminSortKey): number {
  switch (key) {
    case "record":
      return (a.cpRecordId || "").localeCompare(b.cpRecordId || "", undefined, { numeric: true });
    case "title":
      return (a.snapshot.actionTitle.trim() || "").localeCompare(
        b.snapshot.actionTitle.trim() || "",
        undefined,
        { sensitivity: "base" },
      );
    case "department":
      return (a.snapshot.department.trim() || "").localeCompare(
        b.snapshot.department.trim() || "",
        undefined,
        { sensitivity: "base" },
      );
    case "primaryContact":
      return (a.snapshot.primaryContact.name.trim() || "").localeCompare(
        b.snapshot.primaryContact.name.trim() || "",
        undefined,
        { sensitivity: "base" },
      );
    case "owner": {
      const ea = isAdminSavedAction(a) ? (a.ownerEmail ?? "").toLowerCase() : "";
      const eb = isAdminSavedAction(b) ? (b.ownerEmail ?? "").toLowerCase() : "";
      return ea.localeCompare(eb);
    }
    case "policy":
      return policiesJoin(plan, a).localeCompare(policiesJoin(plan, b));
    case "status":
      return submissionStatusLabel(a.status ?? "submitted").localeCompare(
        submissionStatusLabel(b.status ?? "submitted"),
      );
    case "updated":
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    default:
      return 0;
  }
}

function matchesQuery(plan: PlanData, a: SavedAction, q: string): boolean {
  const s = a.snapshot;
  const fields = [
    a.cpRecordId,
    s.actionTitle,
    s.department,
    s.howFurthersPolicies,
    plainTextFromHtml(s.actionDetails),
    s.primaryContact.name,
    s.primaryContact.role,
    s.primaryContact.email,
    s.alternateContact.name,
    s.alternateContact.role,
    s.alternateContact.email,
  ];
  if (isAdminSavedAction(a) && a.ownerEmail) fields.push(a.ownerEmail);

  const items = s.planItems?.length ? s.planItems : [];
  for (const row of items) {
    const sel = resolvePlanItem(plan, row);
    if (sel.chapter) fields.push(chapterLabel(sel.chapter));
    if (sel.policy) fields.push(policyLabel(sel.policy));
  }

  const blob = fields.join(" ").toLowerCase();
  return q.split(/\s+/).every((token) => blob.includes(token));
}

export function AdminSubmissionsList({ plan, actions, showOwner, onOpenSubmission }: Props) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<AdminSortKey>("updated");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) => matchesQuery(plan, a, q));
  }, [plan, actions, query]);

  const sorted = useMemo(() => {
    const mult = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => mult * compareAdmin(plan, a, b, sortKey));
  }, [filtered, plan, sortKey, sortDir]);

  function onSortHeaderClick(key: AdminSortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "updated" ? "desc" : "asc");
    }
  }

  return (
    <section className="admin-card">
      <div className="admin-list-toolbar">
        <h2>All Submissions ({filtered.length})</h2>
        <input
          type="search"
          className="admin-search"
          placeholder="Search by name, department, legislation text, record ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search submissions"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="admin-empty">
          {query ? "No submissions match your search." : "No submissions have been created yet."}
        </p>
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <SortableTh
                  label="Record"
                  colKey="record"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSortHeaderClick}
                />
                <SortableTh
                  label="Legislation Title"
                  colKey="title"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSortHeaderClick}
                />
                <SortableTh
                  label="Department"
                  colKey="department"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSortHeaderClick}
                />
                <SortableTh
                  label="Primary Contact"
                  colKey="primaryContact"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSortHeaderClick}
                />
                {showOwner ? (
                  <SortableTh
                    label="Submitted by"
                    colKey="owner"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={onSortHeaderClick}
                  />
                ) : null}
                <SortableTh
                  label="Policy"
                  colKey="policy"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSortHeaderClick}
                />
                <SortableTh
                  label="Status"
                  colKey="status"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSortHeaderClick}
                />
                <SortableTh
                  label="Updated"
                  colKey="updated"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSortHeaderClick}
                />
              </tr>
            </thead>
            <tbody>
              {sorted.map((a) => {
                const items = a.snapshot.planItems?.length ? a.snapshot.planItems : [];
                const policies = items
                  .map((row) => {
                    const sel = resolvePlanItem(plan, row);
                    return sel.policy ? policyLabel(sel.policy) : "";
                  })
                  .filter(Boolean);
                const polDisplay = policies.length
                  ? policies.length > 1
                    ? `${policies[0]} (+${policies.length - 1})`
                    : policies[0]
                  : "—";
                const status = a.status ?? "submitted";
                const ownerEmail = isAdminSavedAction(a) ? a.ownerEmail : "";

                return (
                  <tr
                    key={a.id}
                    className="admin-row-clickable"
                    onClick={() => onOpenSubmission(a.id)}
                    role="link"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpenSubmission(a.id);
                      }
                    }}
                  >
                    <td className="muted">{a.cpRecordId || "—"}</td>
                    <td>{a.snapshot.actionTitle.trim() || "(Untitled)"}</td>
                    <td>{a.snapshot.department.trim() || "—"}</td>
                    <td>{a.snapshot.primaryContact.name.trim() || "—"}</td>
                    {showOwner && <td className="muted">{ownerEmail || "—"}</td>}
                    <td className="cell-clip" title={policies.join("\n")}>
                      {polDisplay}
                    </td>
                    <td>
                      <span className={`status-pill status-${status}`}>
                        {submissionStatusLabel(status)}
                      </span>
                    </td>
                    <td className="muted">{new Date(a.updatedAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
