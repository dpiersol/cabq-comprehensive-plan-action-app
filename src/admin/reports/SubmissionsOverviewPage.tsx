import { useEffect, useMemo, useState } from "react";
import type { PlanData } from "../../types";
import {
  fetchSubmissionsOverview,
  type SubmissionsOverview,
} from "./reportsApi";

interface Props {
  plan: PlanData | null;
}

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

function goalName(
  plan: PlanData | null,
  chapterIdx: number,
  goalIdx: number,
): { chapter: string; goal: string } {
  if (!plan) return { chapter: `Ch ${chapterIdx}`, goal: `Goal ${goalIdx}` };
  const ch = plan.chapters[chapterIdx];
  if (!ch)
    return {
      chapter: `Chapter ${chapterIdx} (missing)`,
      goal: `Goal ${goalIdx}`,
    };
  const g = ch.goals?.[goalIdx];
  return {
    chapter: `Ch ${ch.chapterNumber} · ${ch.chapterTitle}`,
    goal: g
      ? `${g.goalNumber} · ${g.goalDescription}`
      : `Goal ${goalIdx} (missing)`,
  };
}

export function SubmissionsOverviewPage({ plan }: Props) {
  const [data, setData] = useState<SubmissionsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState(13);

  useEffect(() => {
    let cancelled = false;
    fetchSubmissionsOverview(weeks)
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
  }, [weeks]);

  const maxWeekly = useMemo(
    () => (data ? Math.max(1, ...data.weekly.map((w) => w.count)) : 1),
    [data],
  );

  return (
    <section className="admin-report">
      <header className="admin-report-header">
        <div>
          <a href="#reports" className="admin-back-link">
            ← All reports
          </a>
          <h2>Submissions Overview</h2>
        </div>
        <div className="admin-report-controls">
          <label>
            Range
            <select
              value={weeks}
              onChange={(e) => setWeeks(Number.parseInt(e.target.value, 10))}
            >
              <option value={4}>4 weeks</option>
              <option value={13}>13 weeks (90d)</option>
              <option value={26}>26 weeks (180d)</option>
              <option value={52}>52 weeks (1yr)</option>
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
            <KpiTile label="Total" value={data.kpis.total} />
            <KpiTile label="Submitted" value={data.kpis.submitted} />
            <KpiTile label="Draft" value={data.kpis.draft} />
            <KpiTile label="Created · last 7d" value={data.kpis.createdLast7d} />
            <KpiTile label="Created · last 30d" value={data.kpis.createdLast30d} />
            <KpiTile
              label="Submitted · last 7d"
              value={data.kpis.submittedLast7d}
            />
            <KpiTile
              label="Submitted · last 30d"
              value={data.kpis.submittedLast30d}
            />
          </div>

          <section className="admin-report-section">
            <h3>Submissions per week ({weeks} weeks)</h3>
            <div
              className="admin-bar-chart"
              role="img"
              aria-label="Weekly submission counts"
            >
              {data.weekly.map((w) => (
                <div
                  key={w.weekStart}
                  className="admin-bar-col"
                  title={`${w.weekStart}: ${w.count}`}
                >
                  <div
                    className="admin-bar-fill"
                    style={{
                      height: `${Math.max(2, (w.count / maxWeekly) * 100)}%`,
                    }}
                  >
                    {w.count > 0 && (
                      <span className="admin-bar-value">{w.count}</span>
                    )}
                  </div>
                  <div className="admin-bar-label">{w.weekStart.slice(5)}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="admin-report-section">
            <h3>Top 10 goals by submission count</h3>
            {data.topGoals.length === 0 ? (
              <p className="muted">No goals referenced yet.</p>
            ) : (
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Chapter</th>
                    <th>Goal</th>
                    <th style={{ textAlign: "right" }}>Submissions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topGoals.map((g, i) => {
                    const names = goalName(plan, g.chapterIdx, g.goalIdx);
                    return (
                      <tr key={`${g.chapterIdx}-${g.goalIdx}`}>
                        <td>{i + 1}</td>
                        <td>{names.chapter}</td>
                        <td>{names.goal}</td>
                        <td style={{ textAlign: "right" }}>{g.count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {data.unmapped > 0 && (
              <p className="muted">
                {data.unmapped} submission{data.unmapped === 1 ? "" : "s"} had
                no parseable plan items and were excluded from the goal
                breakdown.
              </p>
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
      <div className="admin-kpi-label">{label}</div>
    </div>
  );
}
