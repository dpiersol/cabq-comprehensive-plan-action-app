import type { PrintFields } from "../printFields";

interface Props {
  fields: PrintFields | null;
}

/**
 * Mirrors the Word print template layout.
 * Hidden on screen; becomes the sole visible content during @media print.
 */
export function PrintPreview({ fields }: Props) {
  if (!fields) return null;

  const chapterLine = [fields.chapterNumber, fields.chapterDescription]
    .filter(Boolean)
    .join(" - ");
  const goalLine = [fields.goal, fields.goalDescription]
    .filter(Boolean)
    .join(" - ");
  const policyLine = [fields.policy, fields.policyDescription]
    .filter(Boolean)
    .join(" \u2013 ");

  return (
    <div className="print-doc" aria-hidden="true">
      {/* Header block — matches Word heading area */}
      <div className="print-doc-header">
        <img
          className="print-doc-seal"
          src="/city-seal.png"
          alt="City of Albuquerque seal"
        />
        <div className="print-doc-header-text">
          <h1 className="print-doc-city">City of Albuquerque</h1>
          <h2 className="print-doc-dept">{fields.departmentName || "\u00A0"}</h2>
          <p className="print-doc-mayor">Timothy M. Keller, Mayor</p>
        </div>
      </div>

      {/* Title row — "Comprehensive Plan Action" left, date right */}
      <div className="print-doc-title-row">
        <span className="print-doc-action-title">Comprehensive Plan Action</span>
        <span className="print-doc-date">{fields.currentDate}</span>
      </div>

      <hr className="print-doc-rule" />

      {/* Field rows matching Word template order */}
      <div className="print-doc-fields">
        <p className="print-doc-field">
          <strong>Legislation Title:</strong> {fields.legislationTitle}
        </p>

        <p className="print-doc-field">
          <strong>Chapter:</strong> {chapterLine}
        </p>

        <p className="print-doc-field">
          <strong>Goal:</strong> {goalLine}
        </p>

        <p className="print-doc-field">
          <strong>Policy:</strong> {policyLine}
        </p>

        <p className="print-doc-heading">
          <strong>Legislation Description:</strong>
        </p>
        <p className="print-doc-body">{fields.legislationDescription}</p>

        <p className="print-doc-heading">
          <strong>How does this legislation further the policies selected?</strong>
        </p>
        <p className="print-doc-body">{fields.howFurthers}</p>
      </div>
    </div>
  );
}
