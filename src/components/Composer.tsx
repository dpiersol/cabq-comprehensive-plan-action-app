import type { Chapter, Goal, GoalDetail, PlanData, Policy, SubPolicy } from "../types";
import type { HierarchyJumpTarget } from "../planSearch/types";
import type { ContactBlock } from "../contacts";
import type { StoredAttachment } from "../draftStorage";
import {
  chapterLabel,
  goalLabel,
  policyLabel,
  subLevelLabel,
  subPolicyOptionLabel,
} from "../labels";
import { HierarchySearch } from "./HierarchySearch";
import { AttachmentField } from "../attachments/AttachmentField";

export interface ComposerProps {
  data: PlanData;
  chapterIdx: number;
  goalIdx: number;
  goalDetailIdx: number;
  policyIdx: number;
  subPolicyIdx: number;
  subLevelIdx: number;
  actionTitle: string;
  department: string;
  primaryContact: ContactBlock;
  alternateContact: ContactBlock;
  attachments: StoredAttachment[];
  actionDetails: string;
  actionDetailsMax: number;
  validationErrors: string[];
  exportStatus: string | null;
  editingLabel: string | null;
  onChapterChange: (i: number) => void;
  onGoalChange: (i: number) => void;
  onGoalDetailChange: (i: number) => void;
  onPolicyChange: (i: number) => void;
  onSubPolicyChange: (i: number) => void;
  onSubLevelChange: (i: number) => void;
  onActionTitleChange: (v: string) => void;
  onDepartmentChange: (v: string) => void;
  onPrimaryContactChange: (c: ContactBlock) => void;
  onAlternateContactChange: (c: ContactBlock) => void;
  onAttachmentsChange: (a: StoredAttachment[]) => void;
  onActionDetailsChange: (v: string) => void;
  onClear: () => void;
  onSaveToLibrary: () => void;
  onCopyJson: () => void;
  onDownloadJson: () => void;
  onPrint: () => void;
  onHierarchyJump: (target: HierarchyJumpTarget) => void;
  /** Submit validated form to workflow API (v0.8+). */
  onSubmitToWorkflow?: () => void | Promise<void>;
  workflowSubmitBusy?: boolean;
  workflowSubmitMessage?: string | null;
}

function ContactGroup({
  legend,
  prefix,
  contact,
  onChange,
  required: requiredBlock,
}: {
  legend: string;
  prefix: string;
  contact: ContactBlock;
  onChange: (c: ContactBlock) => void;
  /** When true, all fields are required for save (a11y + label copy). */
  required?: boolean;
}) {
  const patch = (field: keyof ContactBlock, value: string) =>
    onChange({ ...contact, [field]: value });

  return (
    <fieldset className="contact-group">
      <legend>{legend}</legend>
      <div className="field">
        <label htmlFor={`${prefix}-name`}>
          Name{requiredBlock ? <span className="req-mark"> (required)</span> : null}
        </label>
        <input
          id={`${prefix}-name`}
          type="text"
          autoComplete="name"
          value={contact.name}
          aria-required={requiredBlock ? true : undefined}
          onChange={(e) => patch("name", e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-role`}>
          Role{requiredBlock ? <span className="req-mark"> (required)</span> : null}
        </label>
        <input
          id={`${prefix}-role`}
          type="text"
          autoComplete="organization-title"
          value={contact.role}
          aria-required={requiredBlock ? true : undefined}
          onChange={(e) => patch("role", e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-email`}>
          Email{requiredBlock ? <span className="req-mark"> (required)</span> : null}
        </label>
        <input
          id={`${prefix}-email`}
          type="email"
          autoComplete="email"
          inputMode="email"
          value={contact.email}
          aria-required={requiredBlock ? true : undefined}
          onChange={(e) => patch("email", e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-phone`}>
          Phone{requiredBlock ? <span className="req-mark"> (required)</span> : null}
        </label>
        <input
          id={`${prefix}-phone`}
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          value={contact.phone}
          aria-required={requiredBlock ? true : undefined}
          onChange={(e) => patch("phone", e.target.value)}
        />
      </div>
    </fieldset>
  );
}

export function Composer(props: ComposerProps) {
  const {
    data,
    chapterIdx,
    goalIdx,
    goalDetailIdx,
    policyIdx,
    subPolicyIdx,
    subLevelIdx,
    actionTitle,
    department,
    primaryContact,
    alternateContact,
    attachments,
    actionDetails,
    actionDetailsMax,
    validationErrors,
    exportStatus,
    editingLabel,
    onChapterChange,
    onGoalChange,
    onGoalDetailChange,
    onPolicyChange,
    onSubPolicyChange,
    onSubLevelChange,
    onActionTitleChange,
    onDepartmentChange,
    onPrimaryContactChange,
    onAlternateContactChange,
    onAttachmentsChange,
    onActionDetailsChange,
    onClear,
    onSaveToLibrary,
    onCopyJson,
    onDownloadJson,
    onPrint,
    onHierarchyJump,
    onSubmitToWorkflow,
    workflowSubmitBusy,
    workflowSubmitMessage,
  } = props;

  const chapters = data.chapters;
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

  const summaryLines =
    selectedChapter && chapterIdx >= 0
      ? (() => {
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
        })()
      : null;

  return (
    <div className="composer">
      {editingLabel && (
        <p className="editing-banner" role="status">
          Editing: <strong>{editingLabel}</strong>
        </p>
      )}

      <section className="card print-section" aria-labelledby="hierarchy-heading">
        <h2 id="hierarchy-heading">Comprehensive Plan Items</h2>

        <HierarchySearch data={data} onJump={onHierarchyJump} />

        <div className="field">
          <label htmlFor="chapter">Chapter</label>
          <select
            id="chapter"
            value={chapterIdx}
            onChange={(e) => onChapterChange(Number.parseInt(e.target.value, 10))}
          >
            <option value={-1}>Select chapter...</option>
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
              onChange={(e) => onSubLevelChange(Number.parseInt(e.target.value, 10))}
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

      {summaryLines && (
        <section className="card print-section" aria-labelledby="selection-summary-heading">
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

      <section className="card print-section" aria-labelledby="contact-heading">
        <h2 id="contact-heading">Contact Information</h2>
        <div className="field">
          <label htmlFor="department">Department</label>
          <input
            id="department"
            type="text"
            autoComplete="organization"
            value={department}
            onChange={(e) => onDepartmentChange(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <ContactGroup
          legend="Primary contact information"
          prefix="primary-contact"
          contact={primaryContact}
          onChange={onPrimaryContactChange}
          required
        />
        <ContactGroup
          legend="Alternate contact information"
          prefix="alternate-contact"
          contact={alternateContact}
          onChange={onAlternateContactChange}
        />
      </section>

      <section className="card print-section" aria-labelledby="action-heading">
        <h2 id="action-heading">Action details</h2>
        <div className="field">
          <label htmlFor="action-title">Action title</label>
          <input
            id="action-title"
            type="text"
            autoComplete="off"
            value={actionTitle}
            onChange={(e) => onActionTitleChange(e.target.value)}
            placeholder="Short name for this action (required to save)"
          />
        </div>
        <div className="field">
          <label htmlFor="action-details">Describe the departmental action</label>
          <textarea
            id="action-details"
            value={actionDetails}
            maxLength={actionDetailsMax}
            onChange={(e) => onActionDetailsChange(e.target.value)}
            placeholder="How this action relates to the selected plan elements (implementation, review, coordination, etc.)."
            rows={6}
          />
          <p className="hint char-count" aria-live="polite">
            {actionDetails.length} / {actionDetailsMax} characters
          </p>
        </div>

        <AttachmentField attachments={attachments} onChange={onAttachmentsChange} />

        <p className="hint">
          Draft auto-saves in this browser. Saving to the library stores a local copy. Use{" "}
          <strong>Submit to workflow</strong> when the API is running to record the action in the
          repository.
        </p>
        {workflowSubmitMessage && (
          <p className="export-status" role="status">
            {workflowSubmitMessage}
          </p>
        )}

        {validationErrors.length > 0 && (
          <ul className="validation-errors" role="alert">
            {validationErrors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        )}

        <div className="btn-row no-print">
          <button type="button" className="btn btn-secondary" onClick={onClear}>
            Clear form
          </button>
          <button type="button" className="btn btn-primary" onClick={onSaveToLibrary}>
            Save to library
          </button>
          {onSubmitToWorkflow && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={workflowSubmitBusy}
              onClick={() => void onSubmitToWorkflow()}
            >
              {workflowSubmitBusy ? "Submitting…" : "Submit to workflow"}
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => void onCopyJson()}>
            Copy JSON
          </button>
          <button type="button" className="btn btn-primary" onClick={onDownloadJson}>
            Download JSON
          </button>
          <button type="button" className="btn btn-secondary" onClick={onPrint}>
            Print summary
          </button>
        </div>
        {exportStatus && (
          <p className="export-status" role="status" aria-live="polite">
            {exportStatus}
          </p>
        )}
      </section>
    </div>
  );
}
