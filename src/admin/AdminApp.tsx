import { useCallback, useEffect, useState } from "react";
import type { PlanData } from "../types";
import type { DraftSnapshot } from "../draftStorage";
import type { SavedAction } from "../savedActionsStore";
import { loadSavedActions, updateAction as updateLocalAction } from "../savedActionsStore";
import { APP_VERSION } from "../appVersion";
import { AdminSubmissionsList } from "./AdminSubmissionsList";
import { AdminSubmissionDetail } from "./AdminSubmissionDetail";
import {
  AdminApiUnavailable,
  getAdminSubmission,
  listAdminSubmissions,
  patchAdminSubmission,
  type AdminSavedAction,
} from "./adminApi";
import { seedTestData } from "./seedTestData";

const DATA_URL = "/data/comprehensive-plan-hierarchy.json";

function parseHash(): { page: string; id: string | null } {
  const h = window.location.hash.replace(/^#\/?/, "");
  if (h.startsWith("submission/")) {
    return { page: "detail", id: h.slice("submission/".length) };
  }
  return { page: "list", id: null };
}

type DataSource = "api" | "local" | "loading";

export function AdminApp() {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [route, setRoute] = useState(parseHash);
  const [actions, setActions] = useState<SavedAction[]>([]);
  const [source, setSource] = useState<DataSource>("loading");
  const [fetchError, setFetchError] = useState<string | null>(null);

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
    return () => { cancelled = true; };
  }, []);

  const loadFromApi = useCallback(async () => {
    setFetchError(null);
    try {
      const rows = await listAdminSubmissions();
      setActions(rows);
      setSource("api");
    } catch (err) {
      if (err instanceof AdminApiUnavailable) {
        const seeded = seedTestData();
        if (seeded > 0) console.log(`Seeded ${seeded} local test submissions`);
        setActions(loadSavedActions());
        setSource("local");
      } else {
        setFetchError(err instanceof Error ? err.message : "Failed to load submissions.");
        setSource("local");
        setActions(loadSavedActions());
      }
    }
  }, []);

  useEffect(() => {
    void loadFromApi();
  }, [loadFromApi]);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigateTo = useCallback((hash: string) => {
    window.location.hash = hash;
  }, []);

  const loadDetail = useCallback(
    async (id: string): Promise<SavedAction | null> => {
      if (source === "api") {
        try {
          return await getAdminSubmission(id);
        } catch (err) {
          setFetchError(err instanceof Error ? err.message : "Failed to load submission.");
          return null;
        }
      }
      return actions.find((a) => a.id === id) ?? null;
    },
    [source, actions],
  );

  const saveDetail = useCallback(
    async (id: string, snapshot: DraftSnapshot): Promise<void> => {
      if (source === "api") {
        const updated = await patchAdminSubmission(id, { snapshot });
        if (updated) {
          setActions((prev) => prev.map((a) => (a.id === id ? updated : a)));
        }
        return;
      }
      updateLocalAction(id, snapshot);
      setActions(loadSavedActions());
    },
    [source],
  );

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

  if (!plan) {
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
          Review, search, edit, and print all submitted Comprehensive Plan documents.{" "}
          {source === "api" && (
            <span className="muted">· live from server API</span>
          )}
          {source === "local" && (
            <span className="muted">· local (server API not available — seed data)</span>
          )}
        </p>
        {fetchError && (
          <div className="error-banner" role="alert">{fetchError}</div>
        )}
      </header>

      <main className="admin-main">
        {route.page === "list" && (
          <AdminSubmissionsList
            plan={plan}
            actions={actions}
            showOwner={source === "api"}
            onOpenSubmission={(id) => navigateTo(`#submission/${id}`)}
          />
        )}
        {route.page === "detail" && route.id && (
          <AdminSubmissionDetail
            plan={plan}
            submissionId={route.id}
            loadAction={loadDetail}
            saveAction={saveDetail}
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

function isAdminSavedAction(a: SavedAction): a is AdminSavedAction {
  return typeof (a as AdminSavedAction).ownerEmail === "string";
}

export { isAdminSavedAction };
