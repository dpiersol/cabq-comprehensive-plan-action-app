import { useEffect, useMemo, useState } from "react";
import { fetchUserActivity, type UserActivityReport } from "./reportsApi";

type Filter = "all" | "active" | "locked" | "dormant" | "admins";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function UserActivityPage() {
  const [data, setData] = useState<UserActivityReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let cancelled = false;
    fetchUserActivity()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.localUsers.filter((u) => {
      switch (filter) {
        case "active":
          return u.isActive && !u.isLocked;
        case "locked":
          return u.isLocked;
        case "dormant":
          return (u.daysSinceLogin ?? Infinity) >= 90;
        case "admins":
          return u.roles.includes("comp-plan-admin");
        case "all":
        default:
          return true;
      }
    });
  }, [data, filter]);

  return (
    <section className="admin-report">
      <header className="admin-report-header">
        <div>
          <a href="#reports" className="admin-back-link">
            ← All reports
          </a>
          <h2>User Activity</h2>
        </div>
        <div className="admin-report-controls">
          <label>
            Show
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as Filter)}
            >
              <option value="all">All local users</option>
              <option value="active">Active only</option>
              <option value="admins">Admins only</option>
              <option value="locked">Locked only</option>
              <option value="dormant">Dormant &gt; 90 days</option>
            </select>
          </label>
        </div>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {loading && <div className="loading">Loading report…</div>}

      {data && (
        <>
          <div className="admin-kpi-row">
            <KpiTile label="Local users" value={data.totals.localUsers} />
            <KpiTile label="Active" value={data.totals.activeLocalUsers} />
            <KpiTile label="Admins" value={data.totals.admins} />
            <KpiTile
              label="Dormant &gt; 90d"
              value={data.totals.dormant90d}
            />
          </div>

          <section className="admin-report-section">
            <h3>Local users ({filtered.length})</h3>
            {filtered.length === 0 ? (
              <p className="muted">No users match the current filter.</p>
            ) : (
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Roles</th>
                    <th>Status</th>
                    <th>Last login</th>
                    <th style={{ textAlign: "right" }}>Submitted</th>
                    <th style={{ textAlign: "right" }}>Draft</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.id}>
                      <td>{u.username}</td>
                      <td>{u.displayName}</td>
                      <td>{u.email}</td>
                      <td>
                        {u.roles.length === 0 ? (
                          <span className="muted">—</span>
                        ) : (
                          u.roles.join(", ")
                        )}
                      </td>
                      <td>
                        <StatusBadge
                          active={u.isActive}
                          locked={u.isLocked}
                          dormant={(u.daysSinceLogin ?? Infinity) >= 90}
                        />
                      </td>
                      <td>
                        {formatDate(u.lastLoginAt)}
                        {u.daysSinceLogin !== null && (
                          <span className="muted">
                            {" "}
                            ({u.daysSinceLogin}d)
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {u.submissionsSubmitted}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {u.submissionsDraft}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="admin-report-section">
            <h3>
              Non-local submitters ({data.nonLocalSubmitters.length})
            </h3>
            <p className="muted">
              Emails that have submissions but no matching local account.
              Likely SSO or header-based identities.
            </p>
            {data.nonLocalSubmitters.length === 0 ? (
              <p className="muted">None.</p>
            ) : (
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                    <th style={{ textAlign: "right" }}>Submitted</th>
                    <th style={{ textAlign: "right" }}>Draft</th>
                    <th>Last activity</th>
                  </tr>
                </thead>
                <tbody>
                  {data.nonLocalSubmitters.map((u) => (
                    <tr key={u.email}>
                      <td>{u.email}</td>
                      <td style={{ textAlign: "right" }}>
                        {u.submissionsTotal}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {u.submissionsSubmitted}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {u.submissionsDraft}
                      </td>
                      <td>{formatDate(u.lastSubmissionAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <p className="muted admin-report-footer">
            Generated {formatDate(data.generatedAt)}{" "}
            {new Date(data.generatedAt).toLocaleTimeString()}
          </p>
        </>
      )}
    </section>
  );
}

function KpiTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="admin-kpi">
      <div className="admin-kpi-value">{value.toLocaleString()}</div>
      <div
        className="admin-kpi-label"
        dangerouslySetInnerHTML={{ __html: label }}
      />
    </div>
  );
}

function StatusBadge({
  active,
  locked,
  dormant,
}: {
  active: boolean;
  locked: boolean;
  dormant: boolean;
}) {
  if (!active) return <span className="admin-badge admin-badge-pending">Disabled</span>;
  if (locked) return <span className="admin-badge admin-badge-pending">Locked</span>;
  if (dormant) return <span className="admin-badge admin-badge-pending">Dormant</span>;
  return <span className="admin-badge admin-badge-ready">Active</span>;
}
