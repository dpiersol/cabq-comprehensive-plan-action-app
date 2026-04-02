import { useEffect, useMemo, useRef, useState } from "react";
import { APP_VERSION } from "./appVersion";
import { buildActionRecordFromSnapshot } from "./actionRecord";
import {
  clearDraftStorage,
  emptyDraft,
  emptyPlanItem,
  loadDraftFromStorage,
  normalizeDraft,
  saveDraftToStorage,
  type DraftSnapshot,
  type PlanItemSelection,
} from "./draftStorage";
import type { PlanData } from "./types";
import { validateDraftForExport, validateDraftForSave } from "./validation";
import { emptyContact, type ContactBlock } from "./contacts";
import {
  deleteAction,
  duplicateSnapshot,
  loadSavedActions,
  saveNewAction,
  updateAction,
  type SavedAction,
} from "./savedActionsStore";
import { Composer } from "./components/Composer";
import { SavedActionsPanel } from "./components/SavedActionsPanel";
import type { HierarchyJumpTarget } from "./planSearch/types";

const DATA_URL = "/data/comprehensive-plan-hierarchy.json";

type Tab = "compose" | "library";

function buildSnapshot(state: {
  planItems: PlanItemSelection[];
  actionDetails: string;
  actionTitle: string;
  department: string;
  primaryContact: ContactBlock;
  alternateContact: ContactBlock;
}): DraftSnapshot {
  return {
    planItems: state.planItems.map((p) => ({ ...p })),
    actionDetails: state.actionDetails,
    actionTitle: state.actionTitle,
    department: state.department,
    primaryContact: state.primaryContact,
    alternateContact: state.alternateContact,
  };
}

export function App() {
  const [data, setData] = useState<PlanData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [planItems, setPlanItems] = useState<PlanItemSelection[]>([emptyPlanItem()]);
  const [activePlanItemIndex, setActivePlanItemIndex] = useState(0);
  const [actionDetails, setActionDetails] = useState("");
  const [actionTitle, setActionTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [primaryContact, setPrimaryContact] = useState(emptyContact());
  const [alternateContact, setAlternateContact] = useState(emptyContact());

  const [hydrationDone, setHydrationDone] = useState(false);
  const [tab, setTab] = useState<Tab>("compose");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [libraryVersion, setLibraryVersion] = useState(0);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const pendingActiveAfterAdd = useRef(false);

  const savedCount = useMemo(() => {
    void libraryVersion;
    return loadSavedActions().length;
  }, [libraryVersion]);

  const draftSnapshot = useMemo(
    () =>
      buildSnapshot({
        planItems,
        actionDetails,
        actionTitle,
        department,
        primaryContact,
        alternateContact,
      }),
    [
      planItems,
      actionDetails,
      actionTitle,
      department,
      primaryContact,
      alternateContact,
    ],
  );

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
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!data) {
      setHydrationDone(false);
      return;
    }
    const stored = loadDraftFromStorage();
    const snap = stored ? normalizeDraft(data, stored) : emptyDraft();
    setPlanItems(snap.planItems.map((p) => ({ ...p })));
    setActivePlanItemIndex(0);
    setActionDetails(snap.actionDetails);
    setActionTitle(snap.actionTitle);
    setDepartment(snap.department);
    setPrimaryContact(snap.primaryContact);
    setAlternateContact(snap.alternateContact);
    setHydrationDone(true);
  }, [data]);

  function applySnapshot(snap: DraftSnapshot) {
    setPlanItems(snap.planItems.map((p) => ({ ...p })));
    setActivePlanItemIndex(0);
    setActionDetails(snap.actionDetails);
    setActionTitle(snap.actionTitle);
    setDepartment(snap.department);
    setPrimaryContact(snap.primaryContact);
    setAlternateContact(snap.alternateContact);
  }

  useEffect(() => {
    if (!data || !hydrationDone) return;
    const id = window.setTimeout(() => {
      saveDraftToStorage(draftSnapshot);
    }, 400);
    return () => window.clearTimeout(id);
  }, [data, hydrationDone, draftSnapshot]);

  useEffect(() => {
    if (!pendingActiveAfterAdd.current) return;
    pendingActiveAfterAdd.current = false;
    setActivePlanItemIndex(planItems.length - 1);
  }, [planItems]);

  const onChapterChange = (itemIndex: number, i: number) => {
    setPlanItems((prev) =>
      prev.map((p, j) =>
        j !== itemIndex
          ? p
          : {
              ...p,
              chapterIdx: i,
              goalIdx: -1,
              goalDetailIdx: -1,
              policyIdx: -1,
              subPolicyIdx: -1,
              subLevelIdx: -1,
            },
      ),
    );
  };

  const onGoalChange = (itemIndex: number, i: number) => {
    if (!data) return;
    setPlanItems((prev) =>
      prev.map((p, j) => {
        if (j !== itemIndex) return p;
        if (i < 0) {
          return {
            ...p,
            goalIdx: -1,
            goalDetailIdx: -1,
            policyIdx: -1,
            subPolicyIdx: -1,
            subLevelIdx: -1,
          };
        }
        const chapter = data.chapters[p.chapterIdx];
        const goals = chapter?.goals ?? [];
        const goal = goals[i];
        const goalDetails = goal?.goalDetails ?? [];
        const goalDetailIdx = goalDetails.length > 0 ? 0 : -1;
        return {
          ...p,
          goalIdx: i,
          goalDetailIdx,
          policyIdx: -1,
          subPolicyIdx: -1,
          subLevelIdx: -1,
        };
      }),
    );
  };

  const onGoalDetailChange = (itemIndex: number, i: number) => {
    setPlanItems((prev) =>
      prev.map((p, j) =>
        j !== itemIndex
          ? p
          : {
              ...p,
              goalDetailIdx: i,
              policyIdx: -1,
              subPolicyIdx: -1,
              subLevelIdx: -1,
            },
      ),
    );
  };

  const onPolicyChange = (itemIndex: number, i: number) => {
    setPlanItems((prev) =>
      prev.map((p, j) =>
        j !== itemIndex ? p : { ...p, policyIdx: i, subPolicyIdx: -1, subLevelIdx: -1 },
      ),
    );
  };

  const onSubPolicyChange = (itemIndex: number, i: number) => {
    setPlanItems((prev) =>
      prev.map((p, j) => (j !== itemIndex ? p : { ...p, subPolicyIdx: i, subLevelIdx: -1 })),
    );
  };

  const onSubLevelChange = (itemIndex: number, i: number) => {
    setPlanItems((prev) =>
      prev.map((p, j) => (j !== itemIndex ? p : { ...p, subLevelIdx: i })),
    );
  };

  const addPlanItem = () => {
    pendingActiveAfterAdd.current = true;
    setPlanItems((prev) => [...prev, emptyPlanItem()]);
  };

  const removePlanItemAt = (idx: number) => {
    const items = planItems;
    const active = activePlanItemIndex;
    if (items.length <= 1) return;
    const nextItems = items.filter((_, i) => i !== idx);
    let nextActive = active;
    if (active === idx) nextActive = Math.min(idx, nextItems.length - 1);
    else if (active > idx) nextActive = active - 1;
    setPlanItems(nextItems);
    setActivePlanItemIndex(nextActive);
  };

  const clearForm = () => {
    applySnapshot(emptyDraft());
    clearDraftStorage();
    setEditingId(null);
    setExportStatus(null);
    setValidationErrors([]);
  };

  const saveToLibrary = () => {
    if (!data) return;
    setValidationErrors([]);
    const v = validateDraftForSave(data, draftSnapshot);
    if (!v.ok) {
      setValidationErrors(v.errors);
      setExportStatus(null);
      return;
    }
    if (editingId) {
      updateAction(editingId, draftSnapshot);
      setExportStatus("Saved changes to library.");
    } else {
      saveNewAction(draftSnapshot);
      setExportStatus("Saved to library. Open the Library tab to view or export.");
    }
    setLibraryVersion((n) => n + 1);
    window.setTimeout(() => setExportStatus(null), 5000);
  };

  const copyJson = async () => {
    if (!data) return;
    setValidationErrors([]);
    const v = validateDraftForExport(data, draftSnapshot);
    if (!v.ok) {
      setValidationErrors(v.errors);
      setExportStatus(null);
      return;
    }
    const payload = buildActionRecordFromSnapshot(data, APP_VERSION, draftSnapshot);
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setExportStatus("Copied JSON to clipboard.");
    } catch {
      setExportStatus("Could not copy to clipboard.");
    }
    window.setTimeout(() => setExportStatus(null), 4000);
  };

  const downloadJson = () => {
    if (!data) return;
    setValidationErrors([]);
    const v = validateDraftForExport(data, draftSnapshot);
    if (!v.ok) {
      setValidationErrors(v.errors);
      setExportStatus(null);
      return;
    }
    const payload = buildActionRecordFromSnapshot(data, APP_VERSION, draftSnapshot);
    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = url;
    a.download = `cabq-comp-plan-action-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportStatus("Download started.");
    window.setTimeout(() => setExportStatus(null), 4000);
  };

  const exportAllJson = () => {
    if (!data) return;
    const actions = loadSavedActions();
    const payloads = actions.map((a) => buildActionRecordFromSnapshot(data, APP_VERSION, a.snapshot));
    const bundle = {
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      recordCount: payloads.length,
      records: payloads,
    };
    const text = JSON.stringify(bundle, null, 2);
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cabq-comp-plan-actions-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openEdit = (action: SavedAction) => {
    applySnapshot(action.snapshot);
    setEditingId(action.id);
    setTab("compose");
    setValidationErrors([]);
    setExportStatus(null);
  };

  const duplicateFromLibrary = (action: SavedAction) => {
    applySnapshot(duplicateSnapshot(action.snapshot));
    setEditingId(null);
    setTab("compose");
    setValidationErrors([]);
    setExportStatus("Duplicate loaded — adjust the action title and save.");
    window.setTimeout(() => setExportStatus(null), 5000);
  };

  const removeFromLibrary = (id: string) => {
    deleteAction(id);
    if (editingId === id) {
      setEditingId(null);
    }
    setLibraryVersion((n) => n + 1);
  };

  const onPrint = () => {
    globalThis.print?.();
  };

  const applyHierarchyJump = (t: HierarchyJumpTarget) => {
    const i = activePlanItemIndex;
    setPlanItems((prev) => {
      const next = [...prev];
      const row = next[i] ?? emptyPlanItem();
      next[i] = {
        ...row,
        chapterIdx: t.chapterIdx,
        goalIdx: t.goalIdx,
        goalDetailIdx: t.goalDetailIdx,
        policyIdx: t.policyIdx,
        subPolicyIdx: t.subPolicyIdx,
        subLevelIdx: t.subLevelIdx,
      };
      return next;
    });
    setValidationErrors([]);
  };

  if (loadError) {
    return (
      <div className="app-shell">
        <header className="site-header">
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

  if (!data) {
    return (
      <div className="app-shell">
        <header className="site-header">
          <h1>CABQ Comprehensive Plan — Action documentation</h1>
        </header>
        <main className="site-main">
          <div className="loading">Loading plan hierarchy…</div>
        </main>
      </div>
    );
  }

  const editingLabel =
    editingId && actionTitle.trim()
      ? actionTitle.trim()
      : editingId
        ? "Untitled record"
        : null;

  return (
    <div className="app-shell">
      <header className="site-header no-print">
        <h1>CABQ Comprehensive Plan — Action documentation</h1>
        <p>
          Document departmental actions against the ABC Comprehensive Plan hierarchy (
          <a href="https://www.cabq.gov/planning/plans-publications/abc-comprehensive-plan">
            City planning
          </a>
          {" · "}
          <a href="https://compplan.abq-zone.com/">Interactive plan</a>
          ). Use the composer for cascading selections, save records locally, and export JSON.
        </p>
      </header>

      <nav className="tab-nav no-print" aria-label="Main">
        <button
          type="button"
          className={`tab-btn ${tab === "compose" ? "active" : ""}`}
          onClick={() => setTab("compose")}
        >
          Composer
        </button>
        <button
          type="button"
          className={`tab-btn ${tab === "library" ? "active" : ""}`}
          onClick={() => setTab("library")}
        >
          Library ({savedCount})
        </button>
      </nav>

      <main className="site-main">
        {tab === "compose" && (
          <Composer
            data={data}
            planItems={planItems}
            activePlanItemIndex={activePlanItemIndex}
            actionTitle={actionTitle}
            department={department}
            primaryContact={primaryContact}
            alternateContact={alternateContact}
            actionDetails={actionDetails}
            validationErrors={validationErrors}
            exportStatus={exportStatus}
            editingLabel={editingLabel}
            onActivePlanItemChange={setActivePlanItemIndex}
            onAddPlanItem={addPlanItem}
            onRemovePlanItem={removePlanItemAt}
            onChapterChange={onChapterChange}
            onGoalChange={onGoalChange}
            onGoalDetailChange={onGoalDetailChange}
            onPolicyChange={onPolicyChange}
            onSubPolicyChange={onSubPolicyChange}
            onSubLevelChange={onSubLevelChange}
            onActionTitleChange={setActionTitle}
            onDepartmentChange={setDepartment}
            onPrimaryContactChange={setPrimaryContact}
            onAlternateContactChange={setAlternateContact}
            onActionDetailsChange={setActionDetails}
            onClear={clearForm}
            onSaveToLibrary={saveToLibrary}
            onCopyJson={copyJson}
            onDownloadJson={downloadJson}
            onPrint={onPrint}
            onHierarchyJump={applyHierarchyJump}
          />
        )}
        {tab === "library" && (
          <SavedActionsPanel
            plan={data}
            version={libraryVersion}
            onEdit={openEdit}
            onDuplicate={duplicateFromLibrary}
            onDelete={removeFromLibrary}
            onExportAll={exportAllJson}
          />
        )}
      </main>

      <footer className="site-footer no-print">
        CABQ Comprehensive Plan Action Application · v{APP_VERSION} · Data: comprehensive plan
        export
      </footer>
    </div>
  );
}
