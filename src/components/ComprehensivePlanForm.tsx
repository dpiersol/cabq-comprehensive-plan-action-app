import type { Chapter, Goal, GoalDetail, PlanData, Policy, SubPolicy } from "../types";
import type { SubmissionStatus } from "../submissionStatus";
import { isSubmitted } from "../submissionStatus";
import type { HierarchyJumpTarget } from "../planSearch/types";
import type { ContactBlock } from "../contacts";
import type { PlanItemSelection } from "../draftStorage";
import {
  chapterLabel,
  goalLabel,
  policyLabel,
  subLevelLabel,
  subPolicyOptionLabel,
} from "../labels";
import { HierarchySearch } from "./HierarchySearch";
import { DepartmentCombobox } from "./DepartmentCombobox";
import { ActionDescriptionEditor } from "./ActionDescriptionEditor";
import { FURTHERS_POLICIES_MAX } from "../validation";

export interface ComprehensivePlanFormProps {
  data: PlanData;
  planItems: PlanItemSelection[];
  activePlanItemIndex: number;
  actionTitle: string;
  howFurthersPolicies: string;
  department: string;
  primaryContact: ContactBlock;
  alternateContact: ContactBlock;
  actionDetails: string;
  validationErrors: string[];
  exportStatus: string | null;
  editingLabel: string | null;
  onActivePlanItemChange: (index: number) => void;
  onAddPlanItem: () => void;
  onRemovePlanItem: (index: number) => void;
  onChapterChange: (itemIndex: number, i: number) => void;
  onGoalChange: (itemIndex: number, i: number) => void;
  onGoalDetailChange: (itemIndex: number, i: number) => void;
  onPolicyChange: (itemIndex: number, i: number) => void;
  onSubPolicyChange: (itemIndex: number, i: number) => void;
  onSubLevelChange: (itemIndex: number, i: number) => void;
  onActionTitleChange: (v: string) => void;
  onHowFurthersPoliciesChange: (v: string) => void;
  onDepartmentChange: (v: string) => void;
  onPrimaryContactChange: (c: ContactBlock) => void;
  onAlternateContactChange: (c: ContactBlock) => void;
  onActionDetailsChange: (v: string) => void;
  onSaveForLater: () => void;
  /** Primary action — validates in parent; opens preview before final submit when configured. */
  onSubmit: () => void | Promise<void>;
  onPrintDocument: () => void;
  onHierarchyJump: (target: HierarchyJumpTarget) => void;
  /** When true, plan items + legislation fields are disabled (submitted record). */
  readOnly?: boolean;
  recordStatus?: SubmissionStatus;
  onReopenForEditing?: () => void;
  onDownloadPdf?: () => void;
  onEmailShare?: () => void;
}

function FormComposerActions({
  readOnly,
  onSaveForLater,
  onSubmit,
  onPrintDocument,
  onReopenForEditing,
  onDownloadPdf,
  onEmailShare,
}: {
  readOnly: boolean;
  onSaveForLater: () => void;
  onSubmit: () => void | Promise<void>;
  onPrintDocument: () => void;
  onReopenForEditing?: () => void;
  onDownloadPdf?: () => void;
  onEmailShare?: () => void;
}) {
  if (readOnly) {
    return (
      <div className="form-primary-actions btn-row no-print">
        <button type="button" className="btn btn-secondary" onClick={() => void onReopenForEditing?.()}>
          Reopen for editing
        </button>
        <button type="button" className="btn btn-secondary" onClick={onPrintDocument}>
          Print document
        </button>
        {onDownloadPdf ? (
          <button type="button" className="btn btn-secondary" onClick={onDownloadPdf}>
            Download PDF
          </button>
        ) : null}
        {onEmailShare ? (
          <button type="button" className="btn btn-secondary" onClick={onEmailShare}>
            Email summary
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="form-primary-actions btn-row no-print">
      <button type="button" className="btn btn-secondary" onClick={onSaveForLater}>
        Save draft
      </button>
      <button type="button" className="btn btn-primary" onClick={() => void onSubmit()}>
        Submit record…
      </button>
      <button type="button" className="btn btn-secondary" onClick={onPrintDocument}>
        Print document
      </button>
      {onDownloadPdf ? (
        <button type="button" className="btn btn-secondary" onClick={onDownloadPdf}>
          Download PDF
        </button>
      ) : null}
      {onEmailShare ? (
        <button type="button" className="btn btn-secondary" onClick={onEmailShare}>
          Email summary
        </button>
      ) : null}
    </div>
  );
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

function PlanItemCard({
  data,
  itemIndex,
  item,
  isActive,
  onActivate,
  canRemove,
  onRemove,
  onChapterChange,
  onGoalChange,
  onGoalDetailChange,
  onPolicyChange,
  onSubPolicyChange,
  onSubLevelChange,
}: {
  data: PlanData;
  itemIndex: number;
  item: PlanItemSelection;
  isActive: boolean;
  onActivate: () => void;
  canRemove: boolean;
  onRemove: () => void;
  onChapterChange: (i: number) => void;
  onGoalChange: (i: number) => void;
  onGoalDetailChange: (i: number) => void;
  onPolicyChange: (i: number) => void;
  onSubPolicyChange: (i: number) => void;
  onSubLevelChange: (i: number) => void;
}) {
  const pid = `pi-${itemIndex}`;
  const chapters = data.chapters;
  const chapterIdx = item.chapterIdx;
  const goalIdx = item.goalIdx;
  const goalDetailIdx = item.goalDetailIdx;
  const policyIdx = item.policyIdx;
  const subPolicyIdx = item.subPolicyIdx;
  const subLevelIdx = item.subLevelIdx;

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

  return (
    <div
      className={`plan-item-card${isActive ? " is-active" : ""}`}
      onFocusCapture={onActivate}
      role="group"
      aria-label={`Comprehensive plan item ${itemIndex + 1}${isActive ? " (active for search)" : ""}`}
    >
      <div className="plan-item-card-toolbar">
        <span className="plan-item-card-title">Plan item {itemIndex + 1}</span>
        {canRemove ? (
          <button
            type="button"
            className="btn btn-small btn-danger"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }}
          >
            Remove
          </button>
        ) : null}
      </div>

      <div className="field">
        <label htmlFor={`${pid}-chapter`}>Chapter</label>
        <select
          id={`${pid}-chapter`}
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
          <label htmlFor={`${pid}-goal`}>Goal</label>
          <select
            id={`${pid}-goal`}
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
          <label htmlFor={`${pid}-goal-detail`}>Goal detail</label>
          <select
            id={`${pid}-goal-detail`}
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
          <label htmlFor={`${pid}-policy`}>Policy</label>
          <select
            id={`${pid}-policy`}
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
          <label htmlFor={`${pid}-sub-policy`}>Sub-policy</label>
          <select
            id={`${pid}-sub-policy`}
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
          <label htmlFor={`${pid}-sub-level`}>Sub-policy sub-level</label>
          <select
            id={`${pid}-sub-level`}
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
    </div>
  );
}

export function ComprehensivePlanForm(props: ComprehensivePlanFormProps) {
  const {
    data,
    planItems,
    activePlanItemIndex,
    actionTitle,
    howFurthersPolicies,
    department,
    primaryContact,
    alternateContact,
    actionDetails,
    validationErrors,
    exportStatus,
    editingLabel,
    onActivePlanItemChange,
    onAddPlanItem,
    onRemovePlanItem,
    onChapterChange,
    onGoalChange,
    onGoalDetailChange,
    onPolicyChange,
    onSubPolicyChange,
    onSubLevelChange,
    onActionTitleChange,
    onHowFurthersPoliciesChange,
    onDepartmentChange,
    onPrimaryContactChange,
    onAlternateContactChange,
    onActionDetailsChange,
    onSaveForLater,
    onSubmit,
    onPrintDocument,
    onHierarchyJump,
    readOnly = false,
    recordStatus,
    onReopenForEditing,
    onDownloadPdf,
    onEmailShare,
  } = props;

  const chapters = data.chapters;

  const summaryBlocks = planItems
    .map((row, idx) => {
      const chapterIdx = row.chapterIdx;
      const selectedChapter: Chapter | undefined =
        chapterIdx >= 0 ? chapters[chapterIdx] : undefined;
      if (!selectedChapter || chapterIdx < 0) return null;
      const goals = selectedChapter.goals;
      const selectedGoal: Goal | undefined =
        row.goalIdx >= 0 ? goals[row.goalIdx] : undefined;
      const goalDetails: GoalDetail[] = selectedGoal?.goalDetails ?? [];
      const selectedGoalDetail: GoalDetail | undefined =
        row.goalDetailIdx >= 0 ? goalDetails[row.goalDetailIdx] : undefined;
      const policies: Policy[] = selectedGoalDetail?.policies ?? [];
      const selectedPolicy: Policy | undefined =
        row.policyIdx >= 0 ? policies[row.policyIdx] : undefined;
      const subPolicies: SubPolicy[] = selectedPolicy?.subPolicies ?? [];
      const selectedSubPolicy: SubPolicy | undefined =
        row.subPolicyIdx >= 0 ? subPolicies[row.subPolicyIdx] : undefined;
      const subLevels = selectedSubPolicy?.subLevels ?? [];

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
          value: subPolicyOptionLabel(
            selectedSubPolicy,
            row.subPolicyIdx >= 0 ? row.subPolicyIdx : 0,
          ),
        });
      const sl = row.subLevelIdx >= 0 ? subLevels[row.subLevelIdx] : undefined;
      if (sl) lines.push({ label: "Sub-policy sub-level", value: subLevelLabel(sl) });

      return { idx, lines };
    })
    .filter((b): b is { idx: number; lines: { label: string; value: string }[] } => b !== null);

  const ro = readOnly || isSubmitted(recordStatus);

  return (
    <div className="comprehensive-plan-form">
      {editingLabel && (
        <p className="editing-banner" role="status">
          Editing: <strong>{editingLabel}</strong>
        </p>
      )}
      {isSubmitted(recordStatus) && (
        <p className="editing-banner" role="status">
          This record is <strong>submitted</strong>. Reopen for editing to change fields, or use print / PDF /
          email from the actions below.
        </p>
      )}

      <fieldset className="composer-fieldset" disabled={ro}>
        <section className="card print-section" aria-labelledby="hierarchy-heading">
        <h2 id="hierarchy-heading">Comprehensive Plan Items</h2>

        <p className="hint plan-search-hint">
          Hierarchy search jumps apply to the plan item row you last focused (highlighted).
        </p>
        <HierarchySearch data={data} onJump={onHierarchyJump} />

        <div className="plan-items-stack">
          {planItems.map((item, itemIndex) => (
            <PlanItemCard
              key={itemIndex}
              data={data}
              itemIndex={itemIndex}
              item={item}
              isActive={itemIndex === activePlanItemIndex}
              onActivate={() => onActivePlanItemChange(itemIndex)}
              canRemove={planItems.length > 1}
              onRemove={() => onRemovePlanItem(itemIndex)}
              onChapterChange={(i) => onChapterChange(itemIndex, i)}
              onGoalChange={(i) => onGoalChange(itemIndex, i)}
              onGoalDetailChange={(i) => onGoalDetailChange(itemIndex, i)}
              onPolicyChange={(i) => onPolicyChange(itemIndex, i)}
              onSubPolicyChange={(i) => onSubPolicyChange(itemIndex, i)}
              onSubLevelChange={(i) => onSubLevelChange(itemIndex, i)}
            />
          ))}
        </div>

        <div className="field no-print">
          <button type="button" className="btn btn-secondary" onClick={onAddPlanItem}>
            Add another plan item
          </button>
        </div>
      </section>

      {summaryBlocks.length > 0 && (
        <section className="card print-section" aria-labelledby="selection-summary-heading">
          <h2 id="selection-summary-heading">Current selections</h2>
          {summaryBlocks.map(({ idx, lines }) => (
            <div key={idx} className="selection-summary-block">
              <h3 className="selection-summary-subhead">Plan item {idx + 1}</h3>
              <dl className="summary">
                {lines.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </section>
      )}

      <section className="card print-section" aria-labelledby="contact-heading">
        <h2 id="contact-heading">Contact Information</h2>
        <DepartmentCombobox
          id="department"
          label="Department"
          value={department}
          onChange={onDepartmentChange}
          placeholder="Required — type to search or pick from list"
          required
        />
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
        <h2 id="action-heading">Legislation details</h2>
        <div className="field">
          <label htmlFor="legislation-title">
            Legislation title<span className="req-mark"> (required)</span>
          </label>
          <input
            id="legislation-title"
            type="text"
            autoComplete="off"
            value={actionTitle}
            aria-required
            onChange={(e) => onActionTitleChange(e.target.value)}
            placeholder="Short name for this legislation"
          />
        </div>
        <div className="field">
          <label htmlFor="legislation-description" id="legislation-description-label">
            Legislation description<span className="req-mark"> (required)</span>
          </label>
          <ActionDescriptionEditor
            id="legislation-description"
            labelledBy="legislation-description-label"
            value={actionDetails}
            onChange={onActionDetailsChange}
          />
        </div>
        <div className="field">
          <label htmlFor="how-furthers-policies">
            How does this legislation further policies selected?<span className="req-mark"> (required)</span>
          </label>
          <textarea
            id="how-furthers-policies"
            className="how-furthers-policies-input"
            rows={5}
            maxLength={FURTHERS_POLICIES_MAX}
            value={howFurthersPolicies}
            aria-required
            onChange={(e) => onHowFurthersPoliciesChange(e.target.value)}
            placeholder="Explain how this legislation advances the policies you selected above."
          />
        </div>

        <p className="hint">
          {ro ? (
            <>
              Fields are read-only for submitted records. Choose <strong>Reopen for editing</strong> below to
              make changes.
            </>
          ) : (
            <>
              Draft auto-saves in this browser. Use <strong>Save draft</strong> to persist on the server;{" "}
              <strong>Submit record</strong> opens a final review, then marks the record submitted.
            </>
          )}
        </p>
      </section>
      </fieldset>

        {validationErrors.length > 0 && (
          <ul className="validation-errors" role="alert">
            {validationErrors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        )}

        <FormComposerActions
          readOnly={ro}
          onSaveForLater={onSaveForLater}
          onSubmit={onSubmit}
          onPrintDocument={onPrintDocument}
          onReopenForEditing={onReopenForEditing}
          onDownloadPdf={onDownloadPdf}
          onEmailShare={onEmailShare}
        />
        {exportStatus && (
          <p className="export-status" role="status" aria-live="polite">
            {exportStatus}
          </p>
        )}
    </div>
  );
}
