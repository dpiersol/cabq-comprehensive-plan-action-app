import { useEffect, useMemo, useState } from "react";
import { fetchCoverage, type CoverageReport } from "./reportsApi";

type ChapterFilter = "all" | "with_gaps" | "no_coverage";

export function CoveragePage() {
  const [data, setData] = useState<CoverageReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [chapterFilter, setChapterFilter] = useState<ChapterFilter>("all");

  useEffect(() => {
    let cancelled = false;
    fetchCoverage()
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

  const filteredChapters = useMemo(() => {
    if (!data) return [];
    return data.byChapter.filter((c) => {
      if (chapterFilter === "all") return true;
      if (chapterFilter === "no_coverage") return c.goalsCovered === 0;
      return c.goalsCovered < c.goalsTotal;
    });
  }, [data, chapterFilter]);

  const downloadUncoveredCsv = () => {
    if (!data) return;
    const header = ["chapterIdx", "goalIdx", "chapter", "goal"];
    const rows = [header.join(",")];
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    for (const g of data.uncoveredGoals) {
      rows.push(
        [g.chapterIdx, g.goalIdx, g.chapterName, g.goalName].map(esc).join(","),
      );
    }
    const blob = new Blob([rows.join("\r\n") + "\r\n"], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `coverage-gaps-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="admin-report">
      <header className="admin-report-header">
        <div>
          <a href="#reports" className="admin-back-link">
            ← All reports
          </a>
          <h2>Coverage / Gap Analysis</h2>
        </div>
        <div className="admin-report-controls">
          <label>
            Chapters
            <select
              value={chapterFilter}
              onChange={(e) => setChapterFilter(e.target.value as ChapterFilter)}
            >
              <option value="all">All chapters</option>
              <option value="with_gaps">With uncovered goals</option>
              <option value="no_coverage">Zero submissions</option>
            </select>
          </label>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={downloadUncoveredCsv}
            disabled={!data || data.uncoveredGoals.length === 0}
          >
            Export gap list CSV
          </button>
        </div>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      {loading && <div className="loading">Loading report…</div>}

      {data && !data.planLoaded && (
        <div className="error-banner" role="alert">
          Comprehensive-plan hierarchy JSON was not found on the server. The
          coverage report needs{" "}
          <code>public/data/comprehensive-plan-hierarchy.json</code> (or the
          deployed <code>dist/data/</code> equivalent) to compute gaps.
        </div>
      )}

      {data && data.planLoaded && (
        <>
          <div className="admin-kpi-row">
            <KpiTile label="Chapters" value={data.totals.chapters} />
            <KpiTile label="Goals in plan" value={data.totals.goals} />
            <KpiTile label="Goals covered" value={data.totals.goalsCovered} />
            <KpiTile
              label="Goals uncovered"
              value={data.totals.goalsUncovered}
              tone={data.totals.goalsUncovered === 0 ? "ok" : "warn"}
            />
            <KpiTile label="Policies in plan" value={data.totals.policies} />
            <KpiTile
              label="Policies covered"
              value={data.totals.policiesCovered}
            />
            <KpiTile
              label="Submissions mapped"
              value={data.totals.submissionsMapped}
            />
          </div>

          <section className="admin-report-section">
            <h3>Coverage by chapter</h3>
            {filteredChapters.length === 0 ? (
              <p className="muted">No chapters match the current filter.</p>
            ) : (
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>Chapter</th>
                    <th style={{ textAlign: "right" }}>Goals</th>
                    <th style={{ textAlign: "right" }}>Covered</th>
                    <th>Coverage</th>
                    <th style={{ textAlign: "right" }}>Submissions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChapters.map((c) => {
                    const pct =
                      c.goalsTotal === 0
                        ? 0
                        : Math.round((c.goalsCovered / c.goalsTotal) * 100);
                    return (
                      <tr key={c.chapterIdx}>
                        <td>{c.chapterName}</td>
                        <td style={{ textAlign: "right" }}>{c.goalsTotal}</td>
                        <td style={{ textAlign: "right" }}>{c.goalsCovered}</td>
                        <td>
                          <CoverageBar pct={pct} />
                        </td>
                        <td style={{ textAlign: "right" }}>{c.submissions}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section className="admin-report-section">
            <h3>Uncovered goals ({data.uncoveredGoals.length})</h3>
            <p className="muted">
              Goals the plan contains that no submission has cited. These are
              the gaps.
            </p>
            {data.uncoveredGoals.length === 0 ? (
              <p className="muted">
                Every goal in the plan has at least one submission. Saturation.
              </p>
            ) : (
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>Chapter</th>
                    <th>Goal</th>
                  </tr>
                </thead>
                <tbody>
                  {data.uncoveredGoals.map((g) => (
                    <tr key={`${g.chapterIdx}-${g.goalIdx}`}>
                      <td>{g.chapterName}</td>
                      <td>{g.goalName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="admin-report-section">
            <h3>Most-cited goals (saturation)</h3>
            {data.topGoals.length === 0 ? (
              <p className="muted">No goals have submissions yet.</p>
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
                  {data.topGoals.map((g, i) => (
                    <tr key={`${g.chapterIdx}-${g.goalIdx}`}>
                      <td>{i + 1}</td>
                      <td>{g.chapterName}</td>
                      <td>{g.goalName}</td>
                      <td style={{ textAlign: "right" }}>{g.count}</td>
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

function KpiTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn";
}) {
  const cls =
    tone === "warn" && value > 0
      ? "admin-kpi admin-kpi-warn"
      : "admin-kpi";
  return (
    <div className={cls}>
      <div className="admin-kpi-value">{value.toLocaleString()}</div>
      <div className="admin-kpi-label">{label}</div>
    </div>
  );
}

function CoverageBar({ pct }: { pct: number }) {
  return (
    <div className="admin-coverage-bar" aria-label={`${pct}% covered`}>
      <div className="admin-coverage-bar-fill" style={{ width: `${pct}%` }} />
      <span className="admin-coverage-bar-label">{pct}%</span>
    </div>
  );
}
