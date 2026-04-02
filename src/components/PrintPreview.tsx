import type { PrintFields } from "../printFields";

interface Props {
  fields: PrintFields | null;
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <tr>
      <th className="print-doc-label">{label}</th>
      <td className="print-doc-value">{value}</td>
    </tr>
  );
}

/**
 * Hidden on screen, visible only in `@media print`.
 * Mirrors the 11 Word template placeholders.
 */
export function PrintPreview({ fields }: Props) {
  if (!fields) return null;

  return (
    <div className="print-doc" aria-hidden="true">
      <h1 className="print-doc-title">
        Comprehensive Plan — Legislation Documentation
      </h1>

      <table className="print-doc-table">
        <tbody>
          <Row label="Date" value={fields.currentDate} />
          <Row label="Department" value={fields.departmentName} />
          <Row label="Legislation Title" value={fields.legislationTitle} />
          <Row
            label="Chapter"
            value={
              fields.chapterNumber && fields.chapterDescription
                ? `${fields.chapterNumber} — ${fields.chapterDescription}`
                : fields.chapterNumber || fields.chapterDescription
            }
          />
          <Row
            label="Goal"
            value={
              fields.goal && fields.goalDescription
                ? `${fields.goal} — ${fields.goalDescription}`
                : fields.goal || fields.goalDescription
            }
          />
          <Row
            label="Policy"
            value={
              fields.policy && fields.policyDescription
                ? `${fields.policy} — ${fields.policyDescription}`
                : fields.policy || fields.policyDescription
            }
          />
          <Row
            label="Legislation Description"
            value={fields.legislationDescription}
          />
          <Row
            label="How does this legislation further the policies selected?"
            value={fields.howFurthers}
          />
        </tbody>
      </table>
    </div>
  );
}
