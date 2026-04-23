import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { APP_VERSION } from "../appVersion";
import type { PlanData } from "../types";
import * as submissionsApi from "../submissionsApi";
import type { SavedAction } from "../savedActionsStore";
import { downloadSubmissionPdf } from "../downloadSubmissionPdf";
import { openLegislationMailto } from "../legislationMailto";
import { SavedActionsPanel } from "../components/SavedActionsPanel";
import { SiteHeaderUserBar } from "../components/SiteHeaderUserBar";

const DATA_URL = "/data/comprehensive-plan-hierarchy.json";

/** Signed-in landing: server-backed list of submissions + entry to composer. */
export function AppHomePage() {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actions, setActions] = useState<SavedAction[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(DATA_URL);
        if (!res.ok) throw new Error(`Failed to load plan data (${res.status})`);
        const json = (await res.json()) as PlanData;
        if (!cancelled) setPlan(json);
      } catch (e) {
        if (!cancelled)
          setLoadError(e instanceof Error ? e.message : "Failed to load plan data.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshList = useCallback(async () => {
    setListError(null);
    try {
      const list = await submissionsApi.listSubmissions();
      setActions(list);
      setVersion((v) => v + 1);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Could not load submissions.");
      setActions([]);
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const onEdit = (action: SavedAction) => {
    navigate(`/app/compose?edit=${encodeURIComponent(action.id)}`);
  };

  const onDuplicate = (action: SavedAction) => {
    navigate(`/app/compose?duplicate=${encodeURIComponent(action.id)}`);
  };

  const onDelete = async (id: string) => {
    try {
      await submissionsApi.deleteSubmission(id);
      await refreshList();
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Delete failed.");
    }
  };

  const onDownloadPdf = (a: SavedAction) => {
    if (!plan) return;
    void downloadSubmissionPdf(plan, a.snapshot, `${a.cpRecordId}.pdf`).catch((e: unknown) => {
      setListError(e instanceof Error ? e.message : "PDF download failed.");
    });
  };

  const onEmailShare = (a: SavedAction) => {
    openLegislationMailto({
      cpRecordId: a.cpRecordId,
      title: a.snapshot.actionTitle,
    });
  };

  if (loadError) {
    return (
      <div className="app-shell">
        <header className="site-header no-print">
          <SiteHeaderUserBar />
          <h1>CABQ Comprehensive Plan — Action documentation</h1>
        </header>
        <main className="site-main">
          <div className="error-banner" role="alert">
            {loadError}
          </div>
        </main>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="app-shell">
        <header className="site-header no-print">
          <SiteHeaderUserBar />
          <h1>CABQ Comprehensive Plan — Action documentation</h1>
        </header>
        <main className="site-main">
          <div className="loading">Loading…</div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="site-header no-print">
        <SiteHeaderUserBar />
        <h1>CABQ Comprehensive Plan — Action documentation</h1>
        <p className="site-header-lede">
          Start a new legislation record or open an existing one from your submissions. Records are stored on
          the server for your account.
        </p>
      </header>

      <main className="site-main">
        <section className="card no-print" style={{ marginBottom: "1rem" }}>
          <div className="library-toolbar" style={{ alignItems: "center" }}>
            <h2 className="no-margin">Get started</h2>
            <Link to="/app/compose" state={{ clearComposer: true }} className="btn btn-primary">
              New action
            </Link>
          </div>
        </section>

        {listError ? (
          <div className="error-banner" role="alert">
            {listError}
          </div>
        ) : null}

        <SavedActionsPanel
          plan={plan}
          actions={actions}
          version={version}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onDownloadPdf={onDownloadPdf}
          onEmailShare={onEmailShare}
        />
      </main>

      <footer className="site-footer no-print">
        CABQ Comprehensive Plan Action Application · v{APP_VERSION}
      </footer>
    </div>
  );
}
