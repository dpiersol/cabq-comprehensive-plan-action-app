import { useEffect, useMemo, useState } from "react";
import { fetchLifecycle, type LifecycleReport } from "./reportsApi";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  })} ${d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/**
 * Format a raw hours figure the way people actually say it:
 *   < 2h     → "Xm"
 *   < 48h    → "Xh"
 *   < 30d    → "Xd"
 *   ≥ 30d    → "Xmo"
 */
function humanHours(h: number | null): string {
  if (h === null) return "—";
  if (h < 2) return `${Math.max(1, Math.round(h * 60))}m`;
  if (h < 48) return `${h.toFixed(1)}h`;
  const days = h / 24;
  if (days < 30) return `${days.toFixed(1)}d`;
  const months = days / 30;
  return `${months.toFixed(1)}mo`;
}

export function LifecyclePage() {
  const [data, setData] = useState<LifecycleReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchLifecycle()
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

  const maxMonth = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...data.byMonth.map((m) => m.submissions));
  }, [data]);

  return (
    <section className="admin-report">
      <header className="admin-report-header">
        <div>
          <a href="#reports" className="admin-back-link">
            ← All reports
          </a>
          <h2>Submission Lifecycle / Turnaround</h2>
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
            <KpiTile
              label="In draft right now"
              value={data.currentStatus.draft}
            />
            <KpiTile
              label="Submitted total"
              value={data.currentStatus.submitted}
            />
            <KpiTile
              label="Median draft → submitted"
              text={humanHours(data.draftToSubmitted.medianHours)}
            />
            <KpiTile
              label="p90 draft → submitted"
              text={humanHours(data.draftToSubmitted.p90Hours)}
            />
            <KpiTile
              label="Median open-draft age"
              text={humanHours(data.openDraftAge.medianHours)}
              tone={
                (data.openDraftAge.medianHours ?? 0) > 24 * 7 ? "warn" : "ok"
              }
            />
            <KpiTile
              label="Oldest open draft"
              text={humanHours(data.openDraftAge.maxHours)}
              tone={
                (data.openDraftAge.maxHours ?? 0) > 24 * 30 ? "warn" : "ok"
              }
            />
          </div>

          <section className="admin-report-section">
            <h3>Draft → submitted turnaround</h3>
            <StatsTable stats={data.draftToSubmitted} />
          </section>

          <section className="admin-report-section">
            <h3>Open-draft age (never submitted)</h3>
            <StatsTable stats={data.openDraftAge} />
          </section>

          <section className="admin-report-section">
            <h3>Oldest drafts (top {data.stalestDrafts.length})</h3>
            <p className="muted">
              Submissions that entered their current status the longest time
              ago and haven't moved. Good candidates to clear the backlog.
            </p>
            {data.stalestDrafts.length === 0 ? (
              <p className="muted">No open drafts.</p>
            ) : (
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>Record</th>
                    <th>Owner</th>
                    <th>Status</th>
                    <th>Entered status</th>
                    <th style={{ textAlign: "right" }}>Time in status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stalestDrafts.map((r) => (
                    <tr key={r.submissionId}>
                      <td>
                        <a href={`#submission/${r.submissionId}`}>
                          {r.cpRecordId}
                        </a>
                      </td>
                      <td>{r.ownerEmail ?? <span className="muted">—</span>}</td>
                      <td>{r.currentStatus}</td>
                      <td>{formatDateTime(r.enteredStatusAt)}</td>
                      <td style={{ textAlign: "right" }}>
                        {humanHours(r.hoursInStatus)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="admin-report-section">
            <h3>By month — submissions &amp; median turnaround</h3>
            {data.byMonth.length === 0 ? (
              <p className="muted">Not enough data yet.</p>
            ) : (
              <>
                <div
                  className="admin-bar-chart"
                  role="img"
                  aria-label="Submissions per month"
                >
                  {data.byMonth.map((m) => (
                    <div
                      key={m.month}
                      className="admin-bar-col"
                      title={`${m.month}: ${m.submissions} submissions · median ${humanHours(m.medianDraftHours)}`}
                    >
                      <div
                        className="admin-bar-fill"
                        style={{
                          height: `${Math.max(2, (m.submissions / maxMonth) * 100)}%`,
                        }}
                      >
                        <span className="admin-bar-value">
                          {m.submissions}
                        </span>
                      </div>
                      <div className="admin-bar-label">{m.month}</div>
                    </div>
                  ))}
                </div>
                <table className="admin-users-table" style={{ marginTop: "1rem" }}>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th style={{ textAlign: "right" }}>Submissions</th>
                      <th style={{ textAlign: "right" }}>Median turnaround</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byMonth.map((m) => (
                      <tr key={m.month}>
                        <td>{m.month}</td>
                        <td style={{ textAlign: "right" }}>{m.submissions}</td>
                        <td style={{ textAlign: "right" }}>
                          {humanHours(m.medianDraftHours)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
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

function StatsTable({
  stats,
}: {
  stats: LifecycleReport["draftToSubmitted"];
}) {
  if (stats.n === 0)
    return <p className="muted">No samples yet.</p>;
  return (
    <table className="admin-users-table">
      <thead>
        <tr>
          <th>Samples</th>
          <th style={{ textAlign: "right" }}>Min</th>
          <th style={{ textAlign: "right" }}>Median</th>
          <th style={{ textAlign: "right" }}>p90</th>
          <th style={{ textAlign: "right" }}>Max</th>
          <th style={{ textAlign: "right" }}>Avg</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{stats.n}</td>
          <td style={{ textAlign: "right" }}>{humanHours(stats.minHours)}</td>
          <td style={{ textAlign: "right" }}>{humanHours(stats.medianHours)}</td>
          <td style={{ textAlign: "right" }}>{humanHours(stats.p90Hours)}</td>
          <td style={{ textAlign: "right" }}>{humanHours(stats.maxHours)}</td>
          <td style={{ textAlign: "right" }}>{humanHours(stats.avgHours)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function KpiTile({
  label,
  value,
  text,
  tone,
}: {
  label: string;
  value?: number;
  text?: string;
  tone?: "ok" | "warn";
}) {
  const cls =
    tone === "warn" ? "admin-kpi admin-kpi-warn" : "admin-kpi";
  return (
    <div className={cls}>
      <div className="admin-kpi-value">
        {text ?? (value ?? 0).toLocaleString()}
      </div>
      <div className="admin-kpi-label">{label}</div>
    </div>
  );
}
