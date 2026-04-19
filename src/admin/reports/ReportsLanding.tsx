interface ReportCard {
  hash: string;
  title: string;
  description: string;
  availability: "v4.0.0" | "v4.1.0" | "v4.2.0";
  currentlyAvailable: boolean;
}

const reports: ReportCard[] = [
  {
    hash: "#reports/submissions",
    title: "Submissions Overview",
    description:
      "Totals by status, draft/submitted velocity for the last 7 and 30 days, a 90-day weekly trend chart, and the top 10 most-cited comp-plan goals.",
    availability: "v4.0.0",
    currentlyAvailable: true,
  },
  {
    hash: "#reports/users",
    title: "User Activity",
    description:
      "Every local user with last-login, roles, submission count, plus a separate view of non-local submitters (SSO or header-based). Flags admins dormant for 90+ days.",
    availability: "v4.0.0",
    currentlyAvailable: true,
  },
  {
    hash: "#reports/auth-security",
    title: "Authentication & Security",
    description:
      "Auth audit summary: successful/failed logins, lockouts, password changes, role changes, SSO-config edits. Daily stacked chart, repeated-failure watchlist, and CSV export.",
    availability: "v4.1.0",
    currentlyAvailable: true,
  },
  {
    hash: "#reports/coverage",
    title: "Coverage / Gap Analysis",
    description:
      "Cross-references the comp plan hierarchy against submissions. Flags goals with zero submissions (gaps) and the heaviest-hit (saturation). Exportable gap list.",
    availability: "v4.1.0",
    currentlyAvailable: true,
  },
  {
    hash: "#reports/lifecycle",
    title: "Submission Lifecycle / Turnaround",
    description:
      "Median and p90 time in each status, oldest pending submissions, and bottleneck detection. Requires migration 5 for status-transition history.",
    availability: "v4.2.0",
    currentlyAvailable: false,
  },
];

export function ReportsLanding() {
  return (
    <section className="admin-reports-landing">
      <h2>Reports</h2>
      <p className="muted">
        Admin-only analytics over submissions, users, and auth events. All
        reports read from the live database. Data refreshes each time you open
        the report.
      </p>
      <div className="admin-report-cards">
        {reports.map((r) => (
          <ReportCardView key={r.hash} card={r} />
        ))}
      </div>
    </section>
  );
}

function ReportCardView({ card }: { card: ReportCard }) {
  const isReady = card.currentlyAvailable;
  const body = (
    <>
      <div className="admin-report-card-header">
        <h3>{card.title}</h3>
        <span
          className={
            isReady ? "admin-badge admin-badge-ready" : "admin-badge admin-badge-pending"
          }
        >
          {isReady ? card.availability : `Coming in ${card.availability}`}
        </span>
      </div>
      <p>{card.description}</p>
      {isReady && <span className="admin-report-open">Open report →</span>}
    </>
  );
  if (!isReady) {
    return <div className="admin-report-card admin-report-card-disabled">{body}</div>;
  }
  return (
    <a className="admin-report-card" href={card.hash}>
      {body}
    </a>
  );
}
