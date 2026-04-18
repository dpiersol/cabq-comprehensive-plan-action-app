import { useCallback, useEffect, useState } from "react";
import { fetchAuditLog, type AuditEntry } from "./authAdminApi";

export function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const rows = await fetchAuditLog({
        limit: 200,
        action: filter.trim() || undefined,
      });
      setEntries(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load audit.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="admin-card">
      <h2 style={{ marginTop: 0 }}>Auth audit log</h2>
      {error ? (
        <p className="error-banner" role="alert">
          {error}
        </p>
      ) : null}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <input
          placeholder="Filter by action (optional)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="button" className="btn btn-secondary" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      {loading ? <p className="muted">Loading…</p> : null}
      <table className="admin-users-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Target</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td style={{ whiteSpace: "nowrap" }}>{new Date(e.at).toLocaleString()}</td>
              <td>{e.actor ?? <span className="muted">—</span>}</td>
              <td>
                <code>{e.action}</code>
              </td>
              <td>{e.target ?? <span className="muted">—</span>}</td>
              <td>
                {e.detail ? (
                  <code style={{ fontSize: "0.8em" }}>{e.detail}</code>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
