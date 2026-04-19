import { useEffect, useMemo, useState } from "react";
import {
  downloadAuthAuditCsv,
  fetchAuthSecurity,
  type AuthSecurityReport,
} from "./reportsApi";

const CATEGORY_LABEL: Record<string, string> = {
  login_success: "Login (ok)",
  login_failed: "Login (fail)",
  password_change: "Pwd change",
  user_change: "User change",
  role_change: "Role change",
  sso_config: "SSO config",
};

const CATEGORY_COLOR: Record<string, string> = {
  login_success: "#16a34a",
  login_failed: "#dc2626",
  password_change: "#f59e0b",
  user_change: "#3b82f6",
  role_change: "#8b5cf6",
  sso_config: "#0ea5e9",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
  })} ${d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function AuthSecurityPage() {
  const [data, setData] = useState<AuthSecurityReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAuthSecurity(days)
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
  }, [days]);

  const maxDaily = useMemo(() => {
    if (!data) return 1;
    let m = 1;
    for (const day of data.daily) {
      let sum = 0;
      for (const v of Object.values(day.counts)) sum += v;
      if (sum > m) m = sum;
    }
    return m;
  }, [data]);

  const onDownloadCsv = async () => {
    setCsvError(null);
    setCsvBusy(true);
    try {
      await downloadAuthAuditCsv(days);
    } catch (e) {
      setCsvError(e instanceof Error ? e.message : String(e));
    } finally {
      setCsvBusy(false);
    }
  };

  return (
    <section className="admin-report">
      <header className="admin-report-header">
        <div>
          <a href="#reports" className="admin-back-link">
            ← All reports
          </a>
          <h2>Authentication &amp; Security</h2>
        </div>
        <div className="admin-report-controls">
          <label>
            Window
            <select
              value={days}
              onChange={(e) => setDays(Number.parseInt(e.target.value, 10))}
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
              <option value={180}>180 days</option>
            </select>
          </label>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onDownloadCsv}
            disabled={csvBusy}
          >
            {csvBusy ? "Preparing…" : "Download CSV"}
          </button>
        </div>
      </header>

      {csvError && (
        <div className="error-banner" role="alert">
          {csvError}
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {loading && <div className="loading">Loading report…</div>}

      {data && (
        <>
          <div className="admin-kpi-row">
            <KpiTile label="Successful logins" value={data.totals.loginSuccess} />
            <KpiTile label="Failed logins" value={data.totals.loginFailed} />
            <KpiTile label="Lockouts" value={data.totals.lockouts} />
            <KpiTile
              label="Password changes"
              value={data.totals.passwordChange}
            />
            <KpiTile label="User changes" value={data.totals.userChange} />
            <KpiTile label="Role changes" value={data.totals.roleChange} />
            <KpiTile label="SSO config edits" value={data.totals.ssoConfig} />
          </div>

          <section className="admin-report-section">
            <h3>Daily activity ({data.windowDays} days)</h3>
            <div className="admin-stacked-legend">
              {Object.keys(CATEGORY_LABEL).map((k) => (
                <span key={k} className="admin-legend-item">
                  <span
                    className="admin-legend-swatch"
                    style={{ background: CATEGORY_COLOR[k] }}
                  />
                  {CATEGORY_LABEL[k]}
                </span>
              ))}
            </div>
            <div
              className="admin-bar-chart"
              role="img"
              aria-label="Daily auth events stacked by category"
            >
              {data.daily.map((d) => {
                const total = Object.values(d.counts).reduce(
                  (a, b) => a + b,
                  0,
                );
                const heightPct = total === 0 ? 0 : (total / maxDaily) * 100;
                return (
                  <div
                    key={d.date}
                    className="admin-bar-col"
                    title={`${d.date}: ${total} events`}
                  >
                    <div
                      className="admin-bar-stack"
                      style={{ height: `${Math.max(2, heightPct)}%` }}
                    >
                      {Object.keys(CATEGORY_LABEL).map((k) => {
                        const n = d.counts[k] ?? 0;
                        if (n === 0) return null;
                        const pct = total === 0 ? 0 : (n / total) * 100;
                        return (
                          <span
                            key={k}
                            className="admin-bar-seg"
                            style={{
                              height: `${pct}%`,
                              background: CATEGORY_COLOR[k],
                            }}
                            title={`${CATEGORY_LABEL[k]}: ${n}`}
                          />
                        );
                      })}
                    </div>
                    <div className="admin-bar-label">{d.date.slice(5)}</div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="admin-report-section">
            <h3>Failed-login watchlist</h3>
            <p className="muted">
              Identifiers with the most failed logins in this window. High
              "Distinct IPs" can indicate brute force or credential stuffing.
            </p>
            {data.failureWatchlist.length === 0 ? (
              <p className="muted">No failed logins recorded.</p>
            ) : (
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>Identifier</th>
                    <th style={{ textAlign: "right" }}>Failures</th>
                    <th style={{ textAlign: "right" }}>Distinct IPs</th>
                    <th>Last attempt</th>
                  </tr>
                </thead>
                <tbody>
                  {data.failureWatchlist.map((f) => (
                    <tr key={f.actor}>
                      <td>{f.actor}</td>
                      <td style={{ textAlign: "right" }}>{f.failures}</td>
                      <td style={{ textAlign: "right" }}>{f.distinctIps}</td>
                      <td>{formatDateTime(f.lastAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="admin-report-section">
            <h3>Latest activity (last {data.recent.length})</h3>
            {data.recent.length === 0 ? (
              <p className="muted">No audit events in this window.</p>
            ) : (
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Category</th>
                    <th>Action</th>
                    <th>Actor</th>
                    <th>Target</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((e) => (
                    <tr key={e.id}>
                      <td>{formatDateTime(e.at)}</td>
                      <td>
                        {e.category ? (
                          <span
                            className="admin-legend-swatch"
                            style={{
                              background: CATEGORY_COLOR[e.category] ?? "#94a3b8",
                              marginRight: "0.35rem",
                            }}
                          />
                        ) : null}
                        {e.category ?? <span className="muted">—</span>}
                      </td>
                      <td>{e.action}</td>
                      <td>{e.actor ?? <span className="muted">—</span>}</td>
                      <td>{e.target ?? <span className="muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <p className="muted admin-report-footer">
            Generated {new Date(data.generatedAt).toLocaleString()}
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
      <div className="admin-kpi-label">{label}</div>
    </div>
  );
}
