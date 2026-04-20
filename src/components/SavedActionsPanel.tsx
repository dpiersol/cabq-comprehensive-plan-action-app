import { useMemo, useState } from "react";
import type { PlanData } from "../types";
import type { SavedAction } from "../savedActionsStore";
import { resolvePlanItem } from "../planSelection";
import { policyLabel, chapterLabel } from "../labels";
import { isSubmitted, submissionStatusLabel } from "../submissionStatus";

export interface SavedActionsPanelProps {
  plan: PlanData;
  /** Rows to display (from server or local store). */
  actions: SavedAction[];
  version: number;
  onEdit: (action: SavedAction) => void;
  onDuplicate: (action: SavedAction) => void;
  onDelete: (id: string) => void;
  onDownloadPdf?: (action: SavedAction) => void;
  onEmailShare?: (action: SavedAction) => void;
}

function policyLabelsForSnapshot(plan: PlanData, snapshot: SavedAction["snapshot"]): string[] {
  const rows = snapshot.planItems?.length ? snapshot.planItems : [];
  return rows
    .map((item) => {
      const sel = resolvePlanItem(plan, item);
      return sel.policy ? policyLabel(sel.policy) : "";
    })
    .filter((s) => s.length > 0);
}

export function SavedActionsPanel({
  plan,
  actions: sourceActions,
  version,
  onEdit,
  onDuplicate,
  onDelete,
  onDownloadPdf,
  onEmailShare,
}: SavedActionsPanelProps) {
  const [query, setQuery] = useState("");
  const actions = useMemo(() => {
    void version;
    const list = sourceActions;
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((a) => {
      const s = a.snapshot;
      const t = s.actionTitle.toLowerCase();
      const cp = (a.cpRecordId ?? "").toLowerCase();
      const st = submissionStatusLabel(a.status).toLowerCase();
      const furthers = (s.howFurthersPolicies ?? "").toLowerCase();
      const d = s.department.toLowerCase();
      const pc = s.primaryContact;
      const ac = s.alternateContact;
      const contactBlob = [pc.name, pc.role, pc.email, pc.phone, ac.name, ac.role, ac.email, ac.phone]
        .join(" ")
        .toLowerCase();
      const policiesBlob = policyLabelsForSnapshot(plan, s).join(" ").toLowerCase();
      return (
        t.includes(q) ||
        cp.includes(q) ||
        st.includes(q) ||
        furthers.includes(q) ||
        d.includes(q) ||
        contactBlob.includes(q) ||
        policiesBlob.includes(q)
      );
    });
  }, [plan, version, query, sourceActions]);

  if (actions.length === 0 && !query) {
    return (
      <section className="card">
        <h2>Your submissions</h2>
        <p className="empty-hint">
          No submissions yet. Use <strong>New action</strong>, then <strong>Submit record</strong> when your
          legislation is complete.
        </p>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="library-toolbar">
        <h2>Your submissions</h2>
        <div className="library-actions no-print">
          <input
            type="search"
            className="search-input"
            placeholder="Filter by record ID, status, title, department, contacts, or policies…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter submissions"
          />
        </div>
      </div>

      {actions.length === 0 ? (
        <p className="empty-hint">No matches for your filter.</p>
      ) : (
        <div className="table-wrap">
          <table className="saved-table">
            <thead>
              <tr>
                <th>Record</th>
                <th>Status</th>
                <th>Legislation title</th>
                <th>Department</th>
                <th>Policy</th>
                <th>Updated</th>
                <th className="no-print">Actions</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((a) => {
                const labels = policyLabelsForSnapshot(plan, a.snapshot);
                const firstPol = labels[0] ?? "—";
                const extra = labels.length > 1 ? labels.length - 1 : 0;
                const polDisplay =
                  extra > 0 ? `${firstPol} (+${extra} more)` : firstPol;
                const polTitle = labels.join("\n");
                const firstRow = a.snapshot.planItems?.[0];
                const sel0 = firstRow ? resolvePlanItem(plan, firstRow) : undefined;
                const ch = sel0?.chapter ? chapterLabel(sel0.chapter) : "—";
                const canDelete = !isSubmitted(a.status);
                return (
                  <tr key={a.id}>
                    <td className="muted small">{a.cpRecordId || "—"}</td>
                    <td className="muted small">{submissionStatusLabel(a.status)}</td>
                    <td>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => onEdit(a)}
                        title="Open in Comprehensive Plan"
                      >
                        {a.snapshot.actionTitle.trim() || "(Untitled)"}
                      </button>
                      <div className="muted small">{ch}</div>
                    </td>
                    <td>{a.snapshot.department.trim() || "—"}</td>
                    <td className="cell-clip" title={polTitle}>
                      {polDisplay}
                    </td>
                    <td className="muted small">
                      {new Date(a.updatedAt).toLocaleString()}
                    </td>
                    <td className="no-print table-actions">
                      <button type="button" className="btn btn-small" onClick={() => onEdit(a)}>
                        Open
                      </button>
                      <button type="button" className="btn btn-small" onClick={() => onDuplicate(a)}>
                        Duplicate
                      </button>
                      {onDownloadPdf ? (
                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() => onDownloadPdf(a)}
                        >
                          PDF
                        </button>
                      ) : null}
                      {onEmailShare ? (
                        <button
                          type="button"
                          className="btn btn-small"
                          onClick={() => onEmailShare(a)}
                        >
                          Email
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button
                          type="button"
                          className="btn btn-small btn-danger"
                          onClick={() => {
                            if (globalThis.confirm?.("Delete this draft record?")) onDelete(a.id);
                          }}
                        >
                          Delete
                        </button>
                      ) : null}
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
