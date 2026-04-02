import { useMemo, useState } from "react";
import type { PlanData } from "../types";
import { loadSavedActions, type SavedAction } from "../savedActionsStore";
import { resolvePlanItem } from "../planSelection";
import { chapterLabel, policyLabel } from "../labels";
import { plainTextFromHtml } from "../htmlUtils";

interface Props {
  plan: PlanData;
  onOpenSubmission: (id: string) => void;
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

  const items = s.planItems?.length ? s.planItems : [];
  for (const row of items) {
    const sel = resolvePlanItem(plan, row);
    if (sel.chapter) fields.push(chapterLabel(sel.chapter));
    if (sel.policy) fields.push(policyLabel(sel.policy));
  }

  const blob = fields.join(" ").toLowerCase();
  return q.split(/\s+/).every((token) => blob.includes(token));
}

export function AdminSubmissionsList({ plan, onOpenSubmission }: Props) {
  const [query, setQuery] = useState("");

  const actions = useMemo(() => {
    const all = loadSavedActions();
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((a) => matchesQuery(plan, a, q));
  }, [plan, query]);

  return (
    <section className="admin-card">
      <div className="admin-list-toolbar">
        <h2>All Submissions ({actions.length})</h2>
        <input
          type="search"
          className="admin-search"
          placeholder="Search by name, department, legislation text, record ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search submissions"
        />
      </div>

      {actions.length === 0 ? (
        <p className="admin-empty">
          {query ? "No submissions match your search." : "No submissions have been created yet."}
        </p>
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Record</th>
                <th>Legislation Title</th>
                <th>Department</th>
                <th>Primary Contact</th>
                <th>Policy</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => {
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
                    <td className="cell-clip" title={policies.join("\n")}>
                      {polDisplay}
                    </td>
                    <td className="muted">
                      {new Date(a.updatedAt).toLocaleDateString()}
                    </td>
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
