import type { Chapter, Goal, GoalDetail, PlanData, Policy, SubLevel, SubPolicy } from "./types";
import type { DraftSnapshot, StoredAttachment } from "./draftStorage";
import type { ContactBlock } from "./contacts";
import { resolveSelection } from "./planSelection";

export interface ActionRecordPayload {
  appVersion: string;
  exportedAt: string;
  actionTitle: string;
  department: string;
  primaryContact: ContactBlock;
  alternateContact: ContactBlock;
  attachments: Pick<StoredAttachment, "id" | "fileName" | "mimeType" | "size" | "dataBase64">[];
  chapter: { number: number; title: string } | null;
  goal: { number: string; description: string } | null;
  goalDetail: string | null;
  policy: { number: string; description: string } | null;
  subPolicy: {
    letter?: string;
    description?: string;
    text?: string;
  } | null;
  subLevel: { roman: string | null; description: string | null } | null;
  actionDetails: string;
}

export function buildActionRecord(
  appVersion: string,
  meta: {
    actionTitle: string;
    department: string;
    primaryContact: ContactBlock;
    alternateContact: ContactBlock;
    attachments: StoredAttachment[];
  },
  selected: {
    chapter: Chapter | undefined;
    goal: Goal | undefined;
    goalDetail: GoalDetail | undefined;
    policy: Policy | undefined;
    subPolicy: SubPolicy | undefined;
    subLevel: SubLevel | undefined;
  },
  actionDetails: string,
): ActionRecordPayload {
  const c = selected.chapter;
  const g = selected.goal;
  const gd = selected.goalDetail;
  const p = selected.policy;
  const sp = selected.subPolicy;
  const sl = selected.subLevel;

  return {
    appVersion,
    exportedAt: new Date().toISOString(),
    actionTitle: meta.actionTitle.trim(),
    department: meta.department.trim(),
    primaryContact: {
      name: meta.primaryContact.name.trim(),
      role: meta.primaryContact.role.trim(),
      email: meta.primaryContact.email.trim(),
      phone: meta.primaryContact.phone.trim(),
    },
    alternateContact: {
      name: meta.alternateContact.name.trim(),
      role: meta.alternateContact.role.trim(),
      email: meta.alternateContact.email.trim(),
      phone: meta.alternateContact.phone.trim(),
    },
    attachments: meta.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      size: a.size,
      dataBase64: a.dataBase64,
    })),
    chapter: c ? { number: c.chapterNumber, title: c.chapterTitle } : null,
    goal: g ? { number: g.goalNumber, description: g.goalDescription } : null,
    goalDetail: gd?.detail?.trim() ? gd.detail : null,
    policy: p ? { number: p.policyNumber, description: p.policyDescription } : null,
    subPolicy: sp
      ? {
          letter: sp.letter,
          description: sp.description,
          text: sp.text,
        }
      : null,
    subLevel: sl ? { roman: sl.roman, description: sl.description } : null,
    actionDetails,
  };
}

/** Build a record from a full draft snapshot and plan data (single export path). */
export function buildActionRecordFromSnapshot(
  plan: PlanData,
  appVersion: string,
  snap: DraftSnapshot,
): ActionRecordPayload {
  const sel = resolveSelection(plan, snap);
  return buildActionRecord(
    appVersion,
    {
      actionTitle: snap.actionTitle,
      department: snap.department,
      primaryContact: snap.primaryContact,
      alternateContact: snap.alternateContact,
      attachments: snap.attachments,
    },
    {
      chapter: sel.chapter,
      goal: sel.goal,
      goalDetail: sel.goalDetail,
      policy: sel.policy,
      subPolicy: sel.subPolicy,
      subLevel: sel.subLevel,
    },
    snap.actionDetails,
  );
}
