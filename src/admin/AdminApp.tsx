import { useCallback, useEffect, useState } from "react";
import type { PlanData } from "../types";
import { APP_VERSION } from "../appVersion";
import { AdminSubmissionsList } from "./AdminSubmissionsList";
import { AdminSubmissionDetail } from "./AdminSubmissionDetail";

const DATA_URL = "/data/comprehensive-plan-hierarchy.json";

function parseHash(): { page: string; id: string | null } {
  const h = window.location.hash.replace(/^#\/?/, "");
  if (h.startsWith("submission/")) {
    return { page: "detail", id: h.slice("submission/".length) };
  }
  return { page: "list", id: null };
}

export function AdminApp() {
  const [data, setData] = useState<PlanData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [route, setRoute] = useState(parseHash);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(DATA_URL);
        if (!res.ok) throw new Error(`Failed to load plan data (${res.status})`);
        const json = (await res.json()) as PlanData;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled)
          setLoadError(e instanceof Error ? e.message : "Failed to load plan data.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigateTo = useCallback((hash: string) => {
    window.location.hash = hash;
  }, []);

  if (loadError) {
    return (
      <div className="admin-shell">
        <header className="admin-header">
          <h1>Admin Console</h1>
        </header>
        <main className="admin-main">
          <div className="error-banner" role="alert">{loadError}</div>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="admin-shell">
        <header className="admin-header">
          <h1>Admin Console</h1>
        </header>
        <main className="admin-main">
          <div className="loading">Loading plan data…</div>
        </main>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-row">
          <h1>Admin Console</h1>
          <a href="/" className="admin-back-link">← Back to app</a>
        </div>
        <p className="admin-header-sub">
          Review, search, edit, and print all submitted Comprehensive Plan documents.
        </p>
      </header>

      <main className="admin-main">
        {route.page === "list" && (
          <AdminSubmissionsList
            plan={data}
            onOpenSubmission={(id) => navigateTo(`#submission/${id}`)}
          />
        )}
        {route.page === "detail" && route.id && (
          <AdminSubmissionDetail
            plan={data}
            submissionId={route.id}
            onBack={() => navigateTo("#")}
          />
        )}
      </main>

      <footer className="admin-footer">
        CABQ Comprehensive Plan Admin · v{APP_VERSION}
      </footer>
    </div>
  );
}
