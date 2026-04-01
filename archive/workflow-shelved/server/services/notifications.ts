import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { AppDb } from "../db/client.js";
import { notifications } from "../db/schema.js";
import type { ValidatedSnapshot } from "../validation/snapshot.js";

export interface SnapshotEmails {
  primary: string;
  alternate?: string;
}

export function extractContactEmails(snapshot: ValidatedSnapshot): SnapshotEmails {
  const primary = snapshot.primaryContact.email.trim();
  const alt = snapshot.alternateContact.email.trim();
  return {
    primary,
    ...(alt ? { alternate: alt } : {}),
  };
}

export function insertNotification(
  db: AppDb,
  opts: {
    submissionId: string;
    toAddresses: string[];
    subject: string;
    body: string;
  },
) {
  const id = randomUUID();
  const addr = opts.toAddresses.filter(Boolean).join("; ");
  console.log("[NOTIFICATION]", JSON.stringify({ ...opts, toAddresses: addr, id }));
  db.insert(notifications).values({
    id,
    submissionId: opts.submissionId,
    channel: "email_pending",
    toAddresses: addr,
    subject: opts.subject,
    body: opts.body,
    status: "queued",
    createdAt: new Date(),
  });
}

export function notifyPlanningStaff(
  sqlite: Database.Database,
  db: AppDb,
  submissionId: string,
  subject: string,
  body: string,
) {
  const rows = sqlite
    .prepare(
      "SELECT email FROM users WHERE role = 'planning' AND email IS NOT NULL AND trim(email) != ''",
    )
    .all() as { email: string }[];
  const emails = rows.map((r) => r.email);
  const fallback = emails.length ? emails : ["planning-staff@local.dev"];
  insertNotification(db, {
    submissionId,
    toAddresses: fallback,
    subject,
    body,
  });
}
