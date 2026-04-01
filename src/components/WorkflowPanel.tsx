import { useCallback, useEffect, useState } from "react";
import type { WorkflowAction } from "../api/workflowApi";
import {
  apiGetSubmission,
  apiListSubmissions,
  apiListUsers,
  apiLogin,
  apiMe,
  apiTransition,
  workflowDocumentUrl,
} from "../api/workflowApi";

const ACTION_LABELS: Record<WorkflowAction, string> = {
  send_to_city_council: "Send to City Council for Review",
  request_dept_info: "Request Department Information",
  complete: "Complete",
  review_completed: "Review Completed",
  request_dept_info_council: "Request Department Information",
  further_information_planning: "Further Information Planning",
  dept_submit_response: "Submit response",
};

function actionNeedsWorkflowComments(a: WorkflowAction): boolean {
  return a === "request_dept_info" || a === "request_dept_info_council";
}

function actionNeedsCouncilComments(a: WorkflowAction): boolean {
  return a === "further_information_planning";
}

export function WorkflowPanel() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("workflow_auth_token"));
  const [me, setMe] = useState<{ displayName: string; role: string } | null>(null);
  const [users, setUsers] = useState<{ id: string; displayName: string; role: string }[]>([]);
  const [loginId, setLoginId] = useState("");
  const [list, setList] = useState<
    { id: string; status: string; currentQueue: string; actionTitle: string; updatedAt: string }[]
  >([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof apiGetSubmission>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [wfComments, setWfComments] = useState("");
  const [councilComments, setCouncilComments] = useState("");
  const [busy, setBusy] = useState(false);

  const refreshMe = useCallback(async () => {
    if (!token) {
      setMe(null);
      return;
    }
    try {
      const r = await apiMe();
      setMe(r.user);
    } catch {
      setMe(null);
      localStorage.removeItem("workflow_auth_token");
      setToken(null);
    }
  }, [token]);

  const refreshList = useCallback(async () => {
    if (!token) return;
    try {
      setErr(null);
      const rows = await apiListSubmissions();
      setList(rows);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load list");
    }
  }, [token]);

  useEffect(() => {
    void apiListUsers().then(setUsers).catch(() => {});
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    if (token) void refreshList();
  }, [token, refreshList]);

  useEffect(() => {
    if (!selectedId || !token) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        setErr(null);
        const d = await apiGetSubmission(selectedId);
        if (!cancelled) setDetail(d);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Load failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, token]);

  async function login() {
    if (!loginId) return;
    setBusy(true);
    setErr(null);
    try {
      const { token: t } = await apiLogin(loginId);
      localStorage.setItem("workflow_auth_token", t);
      setToken(t);
      await refreshMe();
      await refreshList();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem("workflow_auth_token");
    setToken(null);
    setMe(null);
    setList([]);
    setSelectedId(null);
    setDetail(null);
  }

  async function runAction(action: WorkflowAction) {
    if (!selectedId || !detail) return;
    setBusy(true);
    setErr(null);
    try {
      await apiTransition(selectedId, {
        action,
        workflowComments: actionNeedsWorkflowComments(action) ? wfComments : undefined,
        councilToPlanningComments: actionNeedsCouncilComments(action) ? councilComments : undefined,
      });
      setWfComments("");
      setCouncilComments("");
      await refreshList();
      const d = await apiGetSubmission(selectedId);
      setDetail(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Transition failed");
    } finally {
      setBusy(false);
    }
  }

  async function downloadDoc() {
    if (!selectedId || !token) return;
    const r = await fetch(workflowDocumentUrl(selectedId), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      setErr("Could not download document.");
      return;
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `action-${selectedId.slice(0, 8)}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const fiLink =
    detail?.fiAccessToken && typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}#/fi/${detail.fiAccessToken}`
      : null;

  if (!token || !me) {
    return (
      <section className="card">
        <h2>Workflow (staff login)</h2>
        <p className="hint">
          Mock login for v0.8.0. Start the API (<code>npm run dev:server</code>) and use dev users from the
          database seed.
        </p>
        {users.length > 0 && (
          <div className="field">
            <label htmlFor="wf-user">User</label>
            <select id="wf-user" value={loginId} onChange={(e) => setLoginId(e.target.value)}>
              <option value="">Select…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName} ({u.role})
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="btn-row">
          <button type="button" className="btn btn-primary" disabled={busy || !loginId} onClick={() => void login()}>
            {busy ? "…" : "Log in"}
          </button>
        </div>
        {err && <p className="validation-errors">{err}</p>}
      </section>
    );
  }

  return (
    <div className="workflow-panel">
      <section className="card">
        <div className="library-toolbar">
          <h2>Workflow inbox</h2>
          <div className="no-print">
            <span className="muted">
              {me.displayName} · {me.role}
            </span>
            <button type="button" className="btn btn-secondary" style={{ marginLeft: "1rem" }} onClick={logout}>
              Log out
            </button>
          </div>
        </div>
        {err && (
          <p className="validation-errors" role="alert">
            {err}
          </p>
        )}
        <div className="table-wrap">
          <table className="saved-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Queue</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr key={row.id}>
                  <td>
                    <button type="button" className="link-button" onClick={() => setSelectedId(row.id)}>
                      {row.actionTitle}
                    </button>
                  </td>
                  <td>{row.currentQueue}</td>
                  <td>{row.status}</td>
                  <td className="muted small">{new Date(row.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">
          <button type="button" className="link-button" onClick={() => void refreshList()}>
            Refresh list
          </button>
        </p>
      </section>

      {selectedId && detail && (
        <section className="card">
          <h2>Submission detail</h2>
          <p>
            <strong>Action title:</strong> {(detail.snapshot as { actionTitle?: string }).actionTitle}
          </p>
          <p>
            <strong>Status / queue:</strong> {detail.status} · {detail.currentQueue}
          </p>
          {detail.workflowComments && (
            <div className="field">
              <span className="field-label">Instructions (department FI)</span>
              <p className="read-only-box">{detail.workflowComments}</p>
            </div>
          )}
          {detail.councilToPlanningComments && (
            <div className="field">
              <span className="field-label">City Council comments for Planning</span>
              <p className="read-only-box">{detail.councilToPlanningComments}</p>
            </div>
          )}
          {fiLink && (
            <p className="hint">
              Department response link:{" "}
              <a href={fiLink} target="_blank" rel="noreferrer">
                {fiLink}
              </a>
            </p>
          )}

          {detail.status === "Complete" && (
            <div className="btn-row">
              <button type="button" className="btn btn-primary" onClick={() => void downloadDoc()}>
                Download Word summary
              </button>
            </div>
          )}

          <h3 className="workflow-actions-heading">Actions</h3>
          {detail.availableActions.some(actionNeedsWorkflowComments) && (
            <div className="field">
              <label htmlFor="wf-cmt">Comments (required for department request)</label>
              <textarea
                id="wf-cmt"
                rows={3}
                value={wfComments}
                onChange={(e) => setWfComments(e.target.value)}
                placeholder="Instructions for the department contact…"
              />
            </div>
          )}
          {detail.availableActions.some(actionNeedsCouncilComments) && (
            <div className="field">
              <label htmlFor="co-cmt">Comments for Planning (required)</label>
              <textarea
                id="co-cmt"
                rows={3}
                value={councilComments}
                onChange={(e) => setCouncilComments(e.target.value)}
                placeholder="What Planning should do next…"
              />
            </div>
          )}

          <div className="btn-row workflow-action-buttons">
            {detail.availableActions.map((a) => (
              <button
                key={a}
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void runAction(a)}
              >
                {ACTION_LABELS[a] ?? a}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
