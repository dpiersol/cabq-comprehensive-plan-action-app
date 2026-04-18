import { useEffect, useMemo, useRef, useState } from "react";
import { APP_VERSION } from "./appVersion";
import {
  emptyDraft,
  emptyPlanItem,
  loadDraftFromStorage,
  normalizeDraft,
  saveDraftToStorage,
  type DraftSnapshot,
  type PlanItemSelection,
} from "./draftStorage";
import type { PlanData } from "./types";
import { validateDraftForSave } from "./validation";
import { emptyContact, type ContactBlock } from "./contacts";
import {
  deleteAction,
  duplicateSnapshot,
  getAction,
  loadSavedActions,
  saveNewAction,
  updateAction,
  type SavedAction,
} from "./savedActionsStore";
import { ComprehensivePlanForm } from "./components/ComprehensivePlanForm";
import { SavedActionsPanel } from "./components/SavedActionsPanel";
import { PrintPreview } from "./components/PrintPreview";
import { buildPrintFields, type PrintFields } from "./printFields";
import type { HierarchyJumpTarget } from "./planSearch/types";
import { SignOutButton } from "./components/SignOutButton";
import { useAuth } from "./useAuth";

const DATA_URL = "/data/comprehensive-plan-hierarchy.json";

type Tab = "compose" | "library";

function buildSnapshot(state: {
  planItems: PlanItemSelection[];
  actionDetails: string;
  actionTitle: string;
  howFurthersPolicies: string;
  department: string;
  primaryContact: ContactBlock;
  alternateContact: ContactBlock;
}): DraftSnapshot {
  return {
    planItems: state.planItems.map((p) => ({ ...p })),
    actionDetails: state.actionDetails,
    actionTitle: state.actionTitle,
    howFurthersPolicies: state.howFurthersPolicies,
    department: state.department,
    primaryContact: state.primaryContact,
    alternateContact: state.alternateContact,
  };
}

/** Main composer + library experience (requires authentication via route guard). */
export function ComposerApp() {
  const { isAdmin } = useAuth();
  const [data, setData] = useState<PlanData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [planItems, setPlanItems] = useState<PlanItemSelection[]>([emptyPlanItem()]);
  const [activePlanItemIndex, setActivePlanItemIndex] = useState(0);
  const [actionDetails, setActionDetails] = useState("");
  const [actionTitle, setActionTitle] = useState("");
  const [howFurthersPolicies, setHowFurthersPolicies] = useState("");
  const [department, setDepartment] = useState("");
  const [primaryContact, setPrimaryContact] = useState(emptyContact());
  const [alternateContact, setAlternateContact] = useState(emptyContact());

  const [hydrationDone, setHydrationDone] = useState(false);
  const [tab, setTab] = useState<Tab>("compose");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [libraryVersion, setLibraryVersion] = useState(0);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [printFields, setPrintFields] = useState<PrintFields | null>(null);
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
        howFurthersPolicies,
        department,
        primaryContact,
        alternateContact,
      }),
    [
      planItems,
      actionDetails,
      actionTitle,
      howFurthersPolicies,
      department,
      primaryContact,
      alternateContact,
    ],
  );

  const editingLabel = useMemo(() => {
    void libraryVersion;
    if (!editingId) return null;
    const rec = getAction(editingId);
    const t = actionTitle.trim() || "Untitled record";
    return rec ? `${rec.cpRecordId} — ${t}` : t;
  }, [editingId, actionTitle, libraryVersion]);

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
    setHowFurthersPolicies(snap.howFurthersPolicies);
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
    setHowFurthersPolicies(snap.howFurthersPolicies);
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

  const saveForLater = () => {
    saveDraftToStorage(draftSnapshot);
    if (editingId) {
      updateAction(editingId, draftSnapshot);
      setLibraryVersion((n) => n + 1);
    }
    setValidationErrors([]);
    setExportStatus(
      editingId
        ? "Progress saved to this browser and to your library record."
        : "Progress saved in this browser. Submit when ready to add to your library.",
    );
    window.setTimeout(() => setExportStatus(null), 5000);
  };

  const submitForm = () => {
    if (!data) return;
    setValidationErrors([]);
    const v = validateDraftForSave(data, draftSnapshot);
    if (!v.ok) {
      setValidationErrors(v.errors);
      setExportStatus(null);
      return;
    }
    setExportStatus(null);
    let saved: SavedAction;
    if (editingId) {
      const u = updateAction(editingId, draftSnapshot);
      if (!u) {
        setExportStatus("Could not update the library record.");
        window.setTimeout(() => setExportStatus(null), 6000);
        return;
      }
      saved = u;
    } else {
      saved = saveNewAction(draftSnapshot);
      setEditingId(saved.id);
    }
    setLibraryVersion((n) => n + 1);
    setExportStatus(`Submitted. Record ${saved.cpRecordId} saved to your library. Use Print document for a paper copy.`);
    window.setTimeout(() => setExportStatus(null), 8000);
  };

  const printDocument = () => {
    if (!data) return;
    setPrintFields(buildPrintFields(data, draftSnapshot));
    requestAnimationFrame(() => window.print());
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
    setExportStatus("Duplicate loaded — adjust the legislation title and submit when ready.");
    window.setTimeout(() => setExportStatus(null), 5000);
  };

  const removeFromLibrary = (id: string) => {
    deleteAction(id);
    if (editingId === id) {
      setEditingId(null);
    }
    setLibraryVersion((n) => n + 1);
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
        <footer className="site-footer no-print">
          CABQ Comprehensive Plan Action Application · v{APP_VERSION} · Plan data: comprehensive plan
          hierarchy JSON
        </footer>
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
        <footer className="site-footer no-print">
          CABQ Comprehensive Plan Action Application · v{APP_VERSION} · Plan data: comprehensive plan
          hierarchy JSON
        </footer>
      </div>
    );
  }

  return (
    <>
      <div className="app-shell">
        <header className="site-header no-print">
          <h1>CABQ Comprehensive Plan — Action documentation</h1>
          <p className="site-header-lede">
            Document departmental actions against the ABC Comprehensive Plan hierarchy (
            <a href="https://www.cabq.gov/planning/plans-publications/abc-comprehensive-plan">
              City planning
            </a>
            {" · "}
            <a href="https://compplan.abq-zone.com/">Interactive plan</a>
            ). Use <strong>Comprehensive Plan</strong> for cascading selections; <strong>Submit</strong> saves
            to your library. Use <strong>Print document</strong> for your browser&apos;s print dialog.
          </p>
        </header>

        <nav className="tab-nav no-print" aria-label="Main">
          <button
            type="button"
            className={`tab-btn ${tab === "compose" ? "active" : ""}`}
            onClick={() => setTab("compose")}
          >
            Comprehensive Plan
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
            <ComprehensivePlanForm
              data={data}
              planItems={planItems}
              activePlanItemIndex={activePlanItemIndex}
              actionTitle={actionTitle}
              howFurthersPolicies={howFurthersPolicies}
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
              onHowFurthersPoliciesChange={setHowFurthersPolicies}
              onDepartmentChange={setDepartment}
              onPrimaryContactChange={setPrimaryContact}
              onAlternateContactChange={setAlternateContact}
              onActionDetailsChange={setActionDetails}
              onSaveForLater={saveForLater}
              onSubmit={submitForm}
              onPrintDocument={printDocument}
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
            />
          )}
        </main>

        <footer className="site-footer no-print">
          CABQ Comprehensive Plan Action Application · v{APP_VERSION}
          {" · "}
          <SignOutButton />
          {isAdmin ? (
            <>
              {" · "}
              <a href="/admin.html" className="admin-link">
                Admin Console
              </a>
            </>
          ) : null}
        </footer>
      </div>

      <PrintPreview fields={printFields} />
    </>
  );
}
