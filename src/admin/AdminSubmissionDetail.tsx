import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { PlanData } from "../types";
import type { DraftSnapshot, PlanItemSelection } from "../draftStorage";
import { emptyPlanItem } from "../draftStorage";
import type { ContactBlock } from "../contacts";
import { emptyContact } from "../contacts";
import type { SavedAction } from "../savedActionsStore";
import { resolvePlanItem } from "../planSelection";
import {
  chapterLabel,
  goalLabel,
  policyLabel,
  subPolicyOptionLabel,
  subLevelLabel,
} from "../labels";
import { plainTextFromHtml } from "../htmlUtils";
import { buildPrintFields } from "../printFields";
import { PrintPreview } from "../components/PrintPreview";

interface Props {
  plan: PlanData;
  submissionId: string;
  loadAction: (id: string) => Promise<SavedAction | null>;
  saveAction: (id: string, snapshot: DraftSnapshot) => Promise<void>;
  onBack: () => void;
}

function ContactFields({
  legend,
  contact,
  editing,
  onChange,
}: {
  legend: string;
  contact: ContactBlock;
  editing: boolean;
  onChange: (c: ContactBlock) => void;
}) {
  const patch = (field: keyof ContactBlock, value: string) =>
    onChange({ ...contact, [field]: value });

  if (!editing) {
    const hasData = contact.name || contact.role || contact.email || contact.phone;
    if (!hasData) return <p className="admin-empty">{legend}: none provided</p>;
    return (
      <div className="admin-contact-ro">
        <strong>{legend}:</strong> {contact.name}
        {contact.role && <> — {contact.role}</>}
        {contact.email && <> · {contact.email}</>}
        {contact.phone && <> · {contact.phone}</>}
      </div>
    );
  }

  return (
    <fieldset className="admin-contact-edit">
      <legend>{legend}</legend>
      <label>
        Name
        <input type="text" value={contact.name} onChange={(e) => patch("name", e.target.value)} />
      </label>
      <label>
        Role
        <input type="text" value={contact.role} onChange={(e) => patch("role", e.target.value)} />
      </label>
      <label>
        Email
        <input type="email" value={contact.email} onChange={(e) => patch("email", e.target.value)} />
      </label>
      <label>
        Phone
        <input type="tel" value={contact.phone} onChange={(e) => patch("phone", e.target.value)} />
      </label>
    </fieldset>
  );
}

function PlanItemRow({
  plan,
  item,
  index,
  editing,
  onChange,
  onRemove,
}: {
  plan: PlanData;
  item: PlanItemSelection;
  index: number;
  editing: boolean;
  onChange: (idx: number, updated: PlanItemSelection) => void;
  onRemove: (idx: number) => void;
}) {
  const sel = resolvePlanItem(plan, item);

  if (!editing) {
    const parts: string[] = [];
    if (sel.chapter) parts.push(chapterLabel(sel.chapter));
    if (sel.goal) parts.push(goalLabel(sel.goal));
    if (sel.policy) parts.push(policyLabel(sel.policy));
    if (sel.subPolicy) parts.push(subPolicyOptionLabel(sel.subPolicy, item.subPolicyIdx));
    if (sel.subLevel) parts.push(subLevelLabel(sel.subLevel));
    return (
      <li className="admin-plan-item-ro">
        {parts.length ? parts.join(" → ") : "(No selection)"}
      </li>
    );
  }

  const chapters = plan.chapters;
  const goals = sel.chapter?.goals ?? [];
  const goalDetails = sel.goal?.goalDetails ?? [];
  const policies = sel.goalDetail?.policies ?? [];

  const set = (patch: Partial<PlanItemSelection>) =>
    onChange(index, { ...item, ...patch });

  return (
    <li className="admin-plan-item-edit">
      <select
        value={item.chapterIdx}
        onChange={(e) =>
          set({
            chapterIdx: +e.target.value,
            goalIdx: -1,
            goalDetailIdx: -1,
            policyIdx: -1,
            subPolicyIdx: -1,
            subLevelIdx: -1,
          })
        }
      >
        <option value={-1}>Select chapter…</option>
        {chapters.map((c, i) => (
          <option key={i} value={i}>{chapterLabel(c)}</option>
        ))}
      </select>

      {goals.length > 0 && (
        <select
          value={item.goalIdx}
          onChange={(e) =>
            set({
              goalIdx: +e.target.value,
              goalDetailIdx: goals[+e.target.value]?.goalDetails?.length ? 0 : -1,
              policyIdx: -1,
              subPolicyIdx: -1,
              subLevelIdx: -1,
            })
          }
        >
          <option value={-1}>Select goal…</option>
          {goals.map((g, i) => (
            <option key={i} value={i}>{goalLabel(g)}</option>
          ))}
        </select>
      )}

      {goalDetails.length > 0 && (
        <select
          value={item.goalDetailIdx}
          onChange={(e) =>
            set({ goalDetailIdx: +e.target.value, policyIdx: -1, subPolicyIdx: -1, subLevelIdx: -1 })
          }
        >
          <option value={-1}>Select goal detail…</option>
          {goalDetails.map((gd, i) => (
            <option key={i} value={i}>{gd.detail || `Goal detail ${i + 1}`}</option>
          ))}
        </select>
      )}

      {policies.length > 0 && (
        <select
          value={item.policyIdx}
          onChange={(e) =>
            set({ policyIdx: +e.target.value, subPolicyIdx: -1, subLevelIdx: -1 })
          }
        >
          <option value={-1}>Select policy…</option>
          {policies.map((p, i) => (
            <option key={i} value={i}>{policyLabel(p)}</option>
          ))}
        </select>
      )}

      <button type="button" className="btn btn-small btn-danger" onClick={() => onRemove(index)}>
        Remove
      </button>
    </li>
  );
}

export function AdminSubmissionDetail({ plan, submissionId, loadAction, saveAction, onBack }: Props) {
  const [original, setOriginal] = useState<SavedAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [printFields, setPrintFields] = useState<ReturnType<typeof buildPrintFields> | null>(null);

  const [actionTitle, setActionTitle] = useState("");
  const [actionDetails, setActionDetails] = useState("");
  const [howFurthers, setHowFurthers] = useState("");
  const [department, setDepartment] = useState("");
  const [primaryContact, setPrimaryContact] = useState<ContactBlock>(emptyContact());
  const [alternateContact, setAlternateContact] = useState<ContactBlock>(emptyContact());
  const [planItems, setPlanItems] = useState<PlanItemSelection[]>([emptyPlanItem()]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadErr(null);
    (async () => {
      try {
        const a = await loadAction(submissionId);
        if (cancelled) return;
        setOriginal(a);
        if (a) {
          setActionTitle(a.snapshot.actionTitle ?? "");
          setActionDetails(a.snapshot.actionDetails ?? "");
          setHowFurthers(a.snapshot.howFurthersPolicies ?? "");
          setDepartment(a.snapshot.department ?? "");
          setPrimaryContact(a.snapshot.primaryContact ?? emptyContact());
          setAlternateContact(a.snapshot.alternateContact ?? emptyContact());
          setPlanItems(a.snapshot.planItems?.map((p) => ({ ...p })) ?? [emptyPlanItem()]);
        }
      } catch (e) {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : "Failed to load submission.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [submissionId, loadAction]);

  const currentSnapshot = useCallback((): DraftSnapshot => ({
    planItems: planItems.map((p) => ({ ...p })),
    actionTitle,
    actionDetails,
    howFurthersPolicies: howFurthers,
    department,
    primaryContact,
    alternateContact,
  }), [planItems, actionTitle, actionDetails, howFurthers, department, primaryContact, alternateContact]);

  if (loading) {
    return (
      <section className="admin-card">
        <button type="button" className="btn btn-secondary" onClick={onBack}>← Back to list</button>
        <p className="admin-empty" style={{ marginTop: "1rem" }}>Loading submission…</p>
      </section>
    );
  }

  if (loadErr) {
    return (
      <section className="admin-card">
        <button type="button" className="btn btn-secondary" onClick={onBack}>← Back to list</button>
        <p className="error-banner" role="alert" style={{ marginTop: "1rem" }}>{loadErr}</p>
      </section>
    );
  }

  if (!original) {
    return (
      <section className="admin-card">
        <button type="button" className="btn btn-secondary" onClick={onBack}>← Back to list</button>
        <p className="admin-empty" style={{ marginTop: "1rem" }}>
          Submission not found. It may have been deleted.
        </p>
      </section>
    );
  }

  const handleSave = async () => {
    setSaveErr(null);
    try {
      await saveAction(submissionId, currentSnapshot());
      setSaved(true);
      window.setTimeout(() => setSaved(false), 4000);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Failed to save changes.");
    }
  };

  const handlePrint = () => {
    setPrintFields(buildPrintFields(plan, currentSnapshot()));
    requestAnimationFrame(() => window.print());
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/admin.html#submission/${submissionId}`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard.");
    } else {
      prompt("Copy this link:", url);
    }
  };

  const updatePlanItem = (idx: number, updated: PlanItemSelection) => {
    setPlanItems((prev) => prev.map((p, i) => (i === idx ? updated : p)));
  };

  const removePlanItem = (idx: number) => {
    if (planItems.length <= 1) return;
    setPlanItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const addPlanItem = () => {
    setPlanItems((prev) => [...prev, emptyPlanItem()]);
  };

  const descriptionText = plainTextFromHtml(actionDetails);

  return (
    <>
    <section className="admin-card">
      <div className="admin-detail-toolbar">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          ← Back to list
        </button>
        <div className="admin-detail-actions">
          <button type="button" className="btn btn-secondary" onClick={handleShare}>
            Share link
          </button>
          <button type="button" className="btn btn-secondary" onClick={handlePrint}>
            Print document
          </button>
          {!editing ? (
            <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>
              Edit
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  void (async () => {
                    await handleSave();
                    setEditing(false);
                  })();
                }}
              >
                Save changes
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {saved && (
        <p className="admin-save-status" role="status">Changes saved.</p>
      )}
      {saveErr && (
        <p className="error-banner" role="alert">{saveErr}</p>
      )}

      <div className="admin-detail-header">
        <h2>{original.cpRecordId} — {actionTitle || "(Untitled)"}</h2>
        <p className="muted">
          Created {new Date(original.createdAt).toLocaleString()} · Updated{" "}
          {new Date(original.updatedAt).toLocaleString()}
        </p>
      </div>

      <div className="admin-detail-section">
        <h3>Department</h3>
        {editing ? (
          <input
            type="text"
            className="admin-input-full"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          />
        ) : (
          <p>{department || "—"}</p>
        )}
      </div>

      <div className="admin-detail-section">
        <h3>Legislation Title</h3>
        {editing ? (
          <input
            type="text"
            className="admin-input-full"
            value={actionTitle}
            onChange={(e) => setActionTitle(e.target.value)}
          />
        ) : (
          <p>{actionTitle || "—"}</p>
        )}
      </div>

      <div className="admin-detail-section">
        <h3>Comprehensive Plan Items</h3>
        <ol className="admin-plan-items">
          {planItems.map((item, i) => (
            <PlanItemRow
              key={i}
              plan={plan}
              item={item}
              index={i}
              editing={editing}
              onChange={updatePlanItem}
              onRemove={removePlanItem}
            />
          ))}
        </ol>
        {editing && (
          <button type="button" className="btn btn-small" onClick={addPlanItem}>
            + Add plan item
          </button>
        )}
      </div>

      <div className="admin-detail-section">
        <h3>Legislation Description</h3>
        {editing ? (
          <textarea
            className="admin-textarea"
            rows={6}
            value={actionDetails}
            onChange={(e) => setActionDetails(e.target.value)}
          />
        ) : (
          <p className="admin-body-text">{descriptionText || "—"}</p>
        )}
      </div>

      <div className="admin-detail-section">
        <h3>How does this legislation further the policies selected?</h3>
        {editing ? (
          <textarea
            className="admin-textarea"
            rows={4}
            value={howFurthers}
            onChange={(e) => setHowFurthers(e.target.value)}
          />
        ) : (
          <p className="admin-body-text">{howFurthers || "—"}</p>
        )}
      </div>

      <div className="admin-detail-section">
        <h3>Contact Information</h3>
        <ContactFields
          legend="Primary Contact"
          contact={primaryContact}
          editing={editing}
          onChange={setPrimaryContact}
        />
        <ContactFields
          legend="Alternate Contact"
          contact={alternateContact}
          editing={editing}
          onChange={setAlternateContact}
        />
      </div>
    </section>

    {/* Portal the print layer to document.body so the @media print rule that
        hides `.admin-shell` doesn't also hide the print document. */}
    {printFields ? createPortal(<PrintPreview fields={printFields} />, document.body) : null}
    </>
  );
}
