import { useEffect, useState } from "react";
import type { DraftSnapshot } from "../draftStorage";
import { apiFiRespond, apiGetFi } from "../api/workflowApi";
import { AttachmentField } from "../attachments/AttachmentField";

interface FiDepartmentRespondProps {
  token: string;
}

export function FiDepartmentRespond({ token }: FiDepartmentRespondProps) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [workflowComments, setWorkflowComments] = useState<string | null>(null);
  const [snap, setSnap] = useState<DraftSnapshot | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let c = false;
    void (async () => {
      try {
        const r = await apiGetFi(token);
        if (c) return;
        setWorkflowComments(r.workflowComments);
        setSnap(r.snapshot as unknown as DraftSnapshot);
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [token]);

  async function submit() {
    if (!snap) return;
    setErr(null);
    try {
      await apiFiRespond(token, snap);
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Submit failed");
    }
  }

  if (loading) return <div className="card">Loading…</div>;
  if (err && !snap) return <div className="card error-banner">{err}</div>;
  if (done) {
    return (
      <section className="card">
        <h2>Thank you</h2>
        <p>Your response was submitted. Staff will be notified.</p>
      </section>
    );
  }
  if (!snap) return null;

  return (
    <div className="app-shell">
      <header className="site-header">
        <h1>Further information — department response</h1>
      </header>
      <main className="site-main">
        <section className="card">
          {workflowComments && (
            <div className="field">
              <span className="field-label">Instructions from staff (read only)</span>
              <p className="read-only-box">{workflowComments}</p>
            </div>
          )}
          <div className="field">
            <label htmlFor="fi-action">Action description</label>
            <textarea
              id="fi-action"
              rows={8}
              value={snap.actionDetails}
              onChange={(e) => setSnap({ ...snap, actionDetails: e.target.value })}
            />
          </div>
          <AttachmentField attachments={snap.attachments} onChange={(a) => setSnap({ ...snap, attachments: a })} />
          {err && <p className="validation-errors">{err}</p>}
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={() => void submit()}>
              Submit response
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
