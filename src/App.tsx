import { useEffect, useMemo, useState } from "react";
import { APP_VERSION } from "./appVersion";
import { buildActionRecordFromSnapshot } from "./actionRecord";
import {
  clearDraftStorage,
  emptyDraft,
  loadDraftFromStorage,
  normalizeDraft,
  saveDraftToStorage,
  type DraftSnapshot,
  type StoredAttachment,
} from "./draftStorage";
import type { PlanData } from "./types";
import { ACTION_DETAILS_MAX, validateDraftForExport, validateDraftForSave } from "./validation";
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
  chapterIdx: number;
  goalIdx: number;
  goalDetailIdx: number;
  policyIdx: number;
  subPolicyIdx: number;
  subLevelIdx: number;
  actionDetails: string;
  actionTitle: string;
  department: string;
  primaryContact: ContactBlock;
  alternateContact: ContactBlock;
  attachments: StoredAttachment[];
}): DraftSnapshot {
  return {
    chapterIdx: state.chapterIdx,
    goalIdx: state.goalIdx,
    goalDetailIdx: state.goalDetailIdx,
    policyIdx: state.policyIdx,
    subPolicyIdx: state.subPolicyIdx,
    subLevelIdx: state.subLevelIdx,
    actionDetails: state.actionDetails,
    actionTitle: state.actionTitle,
    department: state.department,
    primaryContact: state.primaryContact,
    alternateContact: state.alternateContact,
    attachments: state.attachments,
  };
}

export function App() {
  const [data, setData] = useState<PlanData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [chapterIdx, setChapterIdx] = useState(-1);
  const [goalIdx, setGoalIdx] = useState(-1);
  const [goalDetailIdx, setGoalDetailIdx] = useState(-1);
  const [policyIdx, setPolicyIdx] = useState(-1);
  const [subPolicyIdx, setSubPolicyIdx] = useState(-1);
  const [subLevelIdx, setSubLevelIdx] = useState(-1);
  const [actionDetails, setActionDetails] = useState("");
  const [actionTitle, setActionTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [primaryContact, setPrimaryContact] = useState(emptyContact());
  const [alternateContact, setAlternateContact] = useState(emptyContact());
  const [attachments, setAttachments] = useState<StoredAttachment[]>([]);

  const [hydrationDone, setHydrationDone] = useState(false);
  const [tab, setTab] = useState<Tab>("compose");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [libraryVersion, setLibraryVersion] = useState(0);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const savedCount = useMemo(() => {
    void libraryVersion;
    return loadSavedActions().length;
  }, [libraryVersion]);

  const draftSnapshot = useMemo(
    () =>
      buildSnapshot({
        chapterIdx,
        goalIdx,
        goalDetailIdx,
        policyIdx,
        subPolicyIdx,
        subLevelIdx,
        actionDetails,
        actionTitle,
        department,
        primaryContact,
        alternateContact,
        attachments,
      }),
    [
      chapterIdx,
      goalIdx,
      goalDetailIdx,
      policyIdx,
      subPolicyIdx,
      subLevelIdx,
      actionDetails,
      actionTitle,
      department,
      primaryContact,
      alternateContact,
      attachments,
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
    // Always start hierarchy at "Select chapter..."; restore record fields only from draft.
    setChapterIdx(-1);
    setGoalIdx(-1);
    setGoalDetailIdx(-1);
    setPolicyIdx(-1);
    setSubPolicyIdx(-1);
    setSubLevelIdx(-1);
    setActionDetails(snap.actionDetails);
    setActionTitle(snap.actionTitle);
    setDepartment(snap.department);
    setPrimaryContact(snap.primaryContact);
    setAlternateContact(snap.alternateContact);
    setAttachments(snap.attachments);
    setHydrationDone(true);
  }, [data]);

  function applySnapshot(snap: DraftSnapshot) {
    setChapterIdx(snap.chapterIdx);
    setGoalIdx(snap.goalIdx);
    setGoalDetailIdx(snap.goalDetailIdx);
    setPolicyIdx(snap.policyIdx);
    setSubPolicyIdx(snap.subPolicyIdx);
    setSubLevelIdx(snap.subLevelIdx);
    setActionDetails(snap.actionDetails);
    setActionTitle(snap.actionTitle);
    setDepartment(snap.department);
    setPrimaryContact(snap.primaryContact);
    setAlternateContact(snap.alternateContact);
    setAttachments(snap.attachments);
  }

  useEffect(() => {
    if (!data || !hydrationDone) return;
    const id = window.setTimeout(() => {
      saveDraftToStorage(draftSnapshot);
    }, 400);
    return () => window.clearTimeout(id);
  }, [data, hydrationDone, draftSnapshot]);

  const onChapterChange = (i: number) => {
    setChapterIdx(i);
    setGoalIdx(-1);
    setGoalDetailIdx(-1);
    setPolicyIdx(-1);
    setSubPolicyIdx(-1);
    setSubLevelIdx(-1);
  };

  const onGoalChange = (i: number) => {
    setGoalIdx(i);
    setGoalDetailIdx(-1);
    setPolicyIdx(-1);
    setSubPolicyIdx(-1);
    setSubLevelIdx(-1);
  };

  const onGoalDetailChange = (i: number) => {
    setGoalDetailIdx(i);
    setPolicyIdx(-1);
    setSubPolicyIdx(-1);
    setSubLevelIdx(-1);
  };

  const onPolicyChange = (i: number) => {
    setPolicyIdx(i);
    setSubPolicyIdx(-1);
    setSubLevelIdx(-1);
  };

  const onSubPolicyChange = (i: number) => {
    setSubPolicyIdx(i);
    setSubLevelIdx(-1);
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
    setChapterIdx(t.chapterIdx);
    setGoalIdx(t.goalIdx);
    setGoalDetailIdx(t.goalDetailIdx);
    setPolicyIdx(t.policyIdx);
    setSubPolicyIdx(t.subPolicyIdx);
    setSubLevelIdx(t.subLevelIdx);
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
          ). Use the composer for cascading selections, save records locally, and export JSON for
          downstream workflows.
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
            chapterIdx={chapterIdx}
            goalIdx={goalIdx}
            goalDetailIdx={goalDetailIdx}
            policyIdx={policyIdx}
            subPolicyIdx={subPolicyIdx}
            subLevelIdx={subLevelIdx}
            actionTitle={actionTitle}
            department={department}
            primaryContact={primaryContact}
            alternateContact={alternateContact}
            attachments={attachments}
            actionDetails={actionDetails}
            actionDetailsMax={ACTION_DETAILS_MAX}
            validationErrors={validationErrors}
            exportStatus={exportStatus}
            editingLabel={editingLabel}
            onChapterChange={onChapterChange}
            onGoalChange={onGoalChange}
            onGoalDetailChange={onGoalDetailChange}
            onPolicyChange={onPolicyChange}
            onSubPolicyChange={onSubPolicyChange}
            onSubLevelChange={setSubLevelIdx}
            onActionTitleChange={setActionTitle}
            onDepartmentChange={setDepartment}
            onPrimaryContactChange={setPrimaryContact}
            onAlternateContactChange={setAlternateContact}
            onAttachmentsChange={setAttachments}
            onActionDetailsChange={(v) => setActionDetails(v.slice(0, ACTION_DETAILS_MAX))}
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
