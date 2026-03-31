import { useEffect, useMemo, useState } from "react";
import { APP_VERSION } from "./appVersion";
import { buildActionRecord } from "./actionRecord";
import {
  clearDraftStorage,
  emptyDraft,
  loadDraftFromStorage,
  normalizeDraft,
  saveDraftToStorage,
} from "./draftStorage";
import type { Chapter, Goal, GoalDetail, PlanData, Policy, SubPolicy } from "./types";
import {
  chapterLabel,
  goalLabel,
  policyLabel,
  subLevelLabel,
  subPolicyOptionLabel,
} from "./labels";

const DATA_URL = "/data/comprehensive-plan-hierarchy.json";

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
  const [hydrationDone, setHydrationDone] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

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
    setChapterIdx(snap.chapterIdx);
    setGoalIdx(snap.goalIdx);
    setGoalDetailIdx(snap.goalDetailIdx);
    setPolicyIdx(snap.policyIdx);
    setSubPolicyIdx(snap.subPolicyIdx);
    setSubLevelIdx(snap.subLevelIdx);
    setActionDetails(snap.actionDetails);
    setHydrationDone(true);
  }, [data]);

  useEffect(() => {
    if (!data || !hydrationDone) return;
    const id = window.setTimeout(() => {
      saveDraftToStorage({
        chapterIdx,
        goalIdx,
        goalDetailIdx,
        policyIdx,
        subPolicyIdx,
        subLevelIdx,
        actionDetails,
      });
    }, 400);
    return () => window.clearTimeout(id);
  }, [
    data,
    hydrationDone,
    chapterIdx,
    goalIdx,
    goalDetailIdx,
    policyIdx,
    subPolicyIdx,
    subLevelIdx,
    actionDetails,
  ]);

  const chapters = data?.chapters ?? [];

  const selectedChapter: Chapter | undefined =
    chapterIdx >= 0 ? chapters[chapterIdx] : undefined;
  const goals = selectedChapter?.goals ?? [];

  const selectedGoal: Goal | undefined = goalIdx >= 0 ? goals[goalIdx] : undefined;
  const goalDetails: GoalDetail[] = selectedGoal?.goalDetails ?? [];

  const selectedGoalDetail: GoalDetail | undefined =
    goalDetailIdx >= 0 ? goalDetails[goalDetailIdx] : undefined;
  const policies: Policy[] = selectedGoalDetail?.policies ?? [];

  const selectedPolicy: Policy | undefined = policyIdx >= 0 ? policies[policyIdx] : undefined;
  const subPolicies: SubPolicy[] = selectedPolicy?.subPolicies ?? [];

  const selectedSubPolicy: SubPolicy | undefined =
    subPolicyIdx >= 0 ? subPolicies[subPolicyIdx] : undefined;
  const subLevels = selectedSubPolicy?.subLevels ?? [];

  const selectedSubLevel =
    subLevelIdx >= 0 && subLevelIdx < subLevels.length ? subLevels[subLevelIdx] : undefined;

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
    setChapterIdx(-1);
    setGoalIdx(-1);
    setGoalDetailIdx(-1);
    setPolicyIdx(-1);
    setSubPolicyIdx(-1);
    setSubLevelIdx(-1);
    setActionDetails("");
    clearDraftStorage();
    setExportStatus(null);
  };

  const exportPayload = useMemo(
    () =>
      buildActionRecord(
        APP_VERSION,
        {
          chapter: selectedChapter,
          goal: selectedGoal,
          goalDetail: selectedGoalDetail,
          policy: selectedPolicy,
          subPolicy: selectedSubPolicy,
          subLevel: selectedSubLevel,
        },
        actionDetails,
      ),
    [
      selectedChapter,
      selectedGoal,
      selectedGoalDetail,
      selectedPolicy,
      selectedSubPolicy,
      selectedSubLevel,
      actionDetails,
    ],
  );

  const copyJson = async () => {
    const text = JSON.stringify(exportPayload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setExportStatus("Copied JSON to clipboard.");
    } catch {
      setExportStatus("Could not copy — select and copy manually from the console.");
    }
    window.setTimeout(() => setExportStatus(null), 4000);
  };

  const downloadJson = () => {
    const text = JSON.stringify(exportPayload, null, 2);
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

  const summaryLines = useMemo(() => {
    if (!selectedChapter) return null;
    const lines: { label: string; value: string }[] = [
      { label: "Chapter", value: chapterLabel(selectedChapter) },
    ];
    if (selectedGoal) lines.push({ label: "Goal", value: goalLabel(selectedGoal) });
    if (selectedGoalDetail?.detail)
      lines.push({ label: "Goal detail", value: selectedGoalDetail.detail });
    if (selectedPolicy) lines.push({ label: "Policy", value: policyLabel(selectedPolicy) });
    if (selectedSubPolicy)
      lines.push({
        label: "Sub-policy",
        value: subPolicyOptionLabel(selectedSubPolicy, subPolicyIdx >= 0 ? subPolicyIdx : 0),
      });
    const sl = subLevelIdx >= 0 ? subLevels[subLevelIdx] : undefined;
    if (sl) lines.push({ label: "Sub-policy sub-level", value: subLevelLabel(sl) });
    return lines;
  }, [
    selectedChapter,
    selectedGoal,
    selectedGoalDetail,
    selectedPolicy,
    selectedSubPolicy,
    subPolicyIdx,
    subLevelIdx,
    subLevels,
  ]);

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

  return (
    <div className="app-shell">
      <header className="site-header">
        <h1>CABQ Comprehensive Plan — Action documentation</h1>
        <p>
          Prototype for internal use: choose the chapter through sub-level that apply, then describe
          the departmental action. Cascading fields reflect the ABC Comprehensive Plan hierarchy (
          <a href="https://www.cabq.gov/planning/plans-publications/abc-comprehensive-plan">
            City planning
          </a>
          {" · "}
          <a href="https://compplan.abq-zone.com/">Interactive plan</a>
          ). Your draft is saved in this browser until you clear it. SSO and server save will be
          added later.
        </p>
      </header>

      <main className="site-main">
        <section className="card" aria-labelledby="hierarchy-heading">
          <h2 id="hierarchy-heading">Plan hierarchy</h2>

          <div className="field">
            <label htmlFor="chapter">Chapter</label>
            <select
              id="chapter"
              value={chapterIdx}
              onChange={(e) => onChapterChange(Number.parseInt(e.target.value, 10))}
            >
              <option value={-1}>Select chapter…</option>
              {chapters.map((c, i) => (
                <option key={`${c.chapterNumber}-${c.chapterTitle}`} value={i}>
                  {chapterLabel(c)}
                </option>
              ))}
            </select>
          </div>

          {selectedChapter && (
            <div className="field">
              <label htmlFor="goal">Goal</label>
              <select
                id="goal"
                value={goalIdx}
                onChange={(e) => onGoalChange(Number.parseInt(e.target.value, 10))}
              >
                <option value={-1}>Select goal…</option>
                {goals.map((g, i) => (
                  <option key={`${g.goalNumber}-${g.goalDescription}`} value={i}>
                    {goalLabel(g)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedGoal && goalDetails.length > 0 && (
            <div className="field">
              <label htmlFor="goal-detail">Goal detail</label>
              <select
                id="goal-detail"
                value={goalDetailIdx}
                onChange={(e) => onGoalDetailChange(Number.parseInt(e.target.value, 10))}
              >
                <option value={-1}>Select goal detail…</option>
                {goalDetails.map((gd, i) => (
                  <option key={i} value={i}>
                    {gd.detail?.trim() || "(No detail text — policies listed under this goal)"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedGoalDetail && policies.length > 0 && (
            <div className="field">
              <label htmlFor="policy">Policy</label>
              <select
                id="policy"
                value={policyIdx}
                onChange={(e) => onPolicyChange(Number.parseInt(e.target.value, 10))}
              >
                <option value={-1}>Select policy…</option>
                {policies.map((p, i) => (
                  <option key={p.policyNumber} value={i}>
                    {policyLabel(p)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedPolicy && subPolicies.length > 0 && (
            <div className="field">
              <label htmlFor="sub-policy">Sub-policy</label>
              <select
                id="sub-policy"
                value={subPolicyIdx}
                onChange={(e) => onSubPolicyChange(Number.parseInt(e.target.value, 10))}
              >
                <option value={-1}>Select sub-policy…</option>
                {subPolicies.map((sp, i) => (
                  <option key={i} value={i}>
                    {subPolicyOptionLabel(sp, i)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedSubPolicy && subLevels.length > 0 && (
            <div className="field">
              <label htmlFor="sub-level">Sub-policy sub-level</label>
              <select
                id="sub-level"
                value={subLevelIdx}
                onChange={(e) => setSubLevelIdx(Number.parseInt(e.target.value, 10))}
              >
                <option value={-1}>Select sub-level…</option>
                {subLevels.map((sl, i) => (
                  <option key={`${sl.roman}-${i}`} value={i}>
                    {subLevelLabel(sl)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedPolicy && subPolicies.length === 0 && (
            <p className="empty-hint">This policy has no sub-policy rows in the imported data.</p>
          )}
        </section>

        {summaryLines && chapterIdx >= 0 && (
          <section className="card" aria-labelledby="selection-summary-heading">
            <h2 id="selection-summary-heading">Current selection</h2>
            <dl className="summary">
              {summaryLines.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section className="card" aria-labelledby="action-heading">
          <h2 id="action-heading">Action details</h2>
          <div className="field">
            <label htmlFor="action-details">Describe the departmental action</label>
            <textarea
              id="action-details"
              value={actionDetails}
              onChange={(e) => setActionDetails(e.target.value)}
              placeholder="Enter how this action relates to the selected plan elements (implementation, review, coordination, etc.)."
              rows={6}
            />
            <p className="hint">
              Draft is auto-saved in this browser (local storage). Use Export to share a JSON record
              until a server workflow exists. Authentication and submission will be added in a later
              release.
            </p>
          </div>

          <div className="btn-row">
            <button type="button" className="btn btn-secondary" onClick={clearForm}>
              Clear form
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void copyJson()}>
              Copy JSON
            </button>
            <button type="button" className="btn btn-primary" onClick={downloadJson}>
              Download JSON
            </button>
          </div>
          {exportStatus && (
            <p className="export-status" role="status" aria-live="polite">
              {exportStatus}
            </p>
          )}
        </section>
      </main>

      <footer className="site-footer">
        CABQ Comprehensive Plan Action Application · v{APP_VERSION} prototype · Data sourced from
        comprehensive plan export
      </footer>
    </div>
  );
}
