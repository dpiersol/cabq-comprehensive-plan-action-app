import type { PrintFields } from "../printFields";

export interface SubmitPreviewModalProps {
  open: boolean;
  fields: PrintFields | null;
  cpRecordLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Final confirmation before marking a record submitted on the server. */
export function SubmitPreviewModal({
  open,
  fields,
  cpRecordLabel,
  onCancel,
  onConfirm,
}: SubmitPreviewModalProps) {
  if (!open || !fields) return null;

  const rows: { label: string; value: string }[] = [
    { label: "Record", value: cpRecordLabel },
    { label: "Date", value: fields.currentDate },
    { label: "Department", value: fields.departmentName },
    { label: "Legislation title", value: fields.legislationTitle },
    {
      label: "Chapter",
      value: [fields.chapterNumber, fields.chapterDescription].filter(Boolean).join(" — "),
    },
    {
      label: "Goal",
      value: [fields.goal, fields.goalDescription].filter(Boolean).join(" — "),
    },
    {
      label: "Policy",
      value: [fields.policy, fields.policyDescription].filter(Boolean).join(" — "),
    },
    { label: "How furthers policies", value: fields.howFurthers },
  ];

  return (
    <div className="modal-backdrop no-print" role="presentation" onClick={onCancel}>
      <div
        className="modal-card card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="submit-preview-title">Review before submit</h2>
        <p className="hint">
          This saves your record as <strong>Submitted</strong> in your library. You can reopen it for editing
          later if something changes.
        </p>
        <dl className="summary submit-preview-dl">
          {rows.map((r) => (
            <div key={r.label}>
              <dt>{r.label}</dt>
              <dd>{r.value.trim() ? r.value : "—"}</dd>
            </div>
          ))}
        </dl>
        <div className="rich-preview-block">
          <h3 className="submit-preview-sub">Legislation description</h3>
          <p className="submit-preview-plain">{fields.legislationDescription.trim() || "—"}</p>
        </div>
        <div className="btn-row modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Back to editing
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            Confirm submit
          </button>
        </div>
      </div>
    </div>
  );
}
