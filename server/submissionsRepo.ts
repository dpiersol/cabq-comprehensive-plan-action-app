import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { PatchSubmissionBody, SubmissionStatus } from "./submissionPatchBody.js";

function recordStatusTransition(
  db: Database.Database,
  submissionId: string,
  fromStatus: SubmissionStatus | null,
  toStatus: SubmissionStatus,
  actor: string | null,
  at: string,
): void {
  db.prepare(
    `INSERT INTO submission_status_history
       (submission_id, from_status, to_status, actor, at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(submissionId, fromStatus, toStatus, actor, at);
}

/** Mirrors client `SavedAction`; snapshot is validated at the HTTP boundary. */
export interface SavedActionDto {
  id: string;
  cpRecordId: string;
  status: SubmissionStatus;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  snapshot: unknown;
}

function parseStatus(raw: string): SubmissionStatus {
  return raw === "submitted" ? "submitted" : "draft";
}

function maxCpNumber(db: Database.Database, ownerKey: string): number {
  const rows = db
    .prepare(
      `SELECT cp_record_id FROM submissions WHERE owner_key = ? AND cp_record_id LIKE 'CP-%'`,
    )
    .all(ownerKey) as { cp_record_id: string }[];
  let max = 0;
  for (const r of rows) {
    const m = /^CP-(\d+)$/.exec(r.cp_record_id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

function nextCpRecordId(db: Database.Database, ownerKey: string): string {
  const n = maxCpNumber(db, ownerKey) + 1;
  return `CP-${String(n).padStart(6, "0")}`;
}

function rowToDto(r: {
  id: string;
  cp_record_id: string;
  status: string;
  snapshot_json: string;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}): SavedActionDto {
  return {
    id: r.id,
    cpRecordId: r.cp_record_id,
    status: parseStatus(r.status),
    submittedAt: r.submitted_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    snapshot: JSON.parse(r.snapshot_json) as unknown,
  };
}

export function listByOwner(db: Database.Database, ownerKey: string): SavedActionDto[] {
  const rows = db
    .prepare(
      `SELECT id, cp_record_id, status, snapshot_json, submitted_at, created_at, updated_at
       FROM submissions WHERE owner_key = ?
       ORDER BY updated_at DESC`,
    )
    .all(ownerKey) as {
    id: string;
    cp_record_id: string;
    status: string;
    snapshot_json: string;
    submitted_at: string | null;
    created_at: string;
    updated_at: string;
  }[];

  return rows.map(rowToDto);
}

export function getById(
  db: Database.Database,
  ownerKey: string,
  id: string,
): SavedActionDto | null {
  const row = db
    .prepare(
      `SELECT id, cp_record_id, status, snapshot_json, submitted_at, created_at, updated_at
       FROM submissions WHERE owner_key = ? AND id = ?`,
    )
    .get(ownerKey, id) as
    | {
        id: string;
        cp_record_id: string;
        status: string;
        snapshot_json: string;
        submitted_at: string | null;
        created_at: string;
        updated_at: string;
      }
    | undefined;
  if (!row) return null;
  return rowToDto(row);
}

export function insertSubmission(
  db: Database.Database,
  ownerKey: string,
  snapshot: unknown,
  initialStatus: SubmissionStatus = "draft",
  ownerEmail: string | null = null,
): SavedActionDto {
  const id = randomUUID();
  const now = new Date().toISOString();
  const cpRecordId = nextCpRecordId(db, ownerKey);
  const snapshotJson = JSON.stringify(snapshot);
  const submittedAt = initialStatus === "submitted" ? now : null;
  db.prepare(
    `INSERT INTO submissions (id, owner_key, cp_record_id, status, snapshot_json, submitted_at, created_at, updated_at, owner_email)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    ownerKey,
    cpRecordId,
    initialStatus,
    snapshotJson,
    submittedAt,
    now,
    now,
    ownerEmail || null,
  );
  // First lifecycle event: created as draft (or as submitted if the caller
  // went straight to submitted — rare but supported).
  recordStatusTransition(db, id, null, "draft", ownerEmail || null, now);
  if (initialStatus === "submitted") {
    recordStatusTransition(
      db,
      id,
      "draft",
      "submitted",
      ownerEmail || null,
      submittedAt ?? now,
    );
  }
  return getById(db, ownerKey, id)!;
}

export function patchSubmission(
  db: Database.Database,
  ownerKey: string,
  id: string,
  patch: PatchSubmissionBody,
): SavedActionDto | null {
  const existing = getById(db, ownerKey, id);
  if (!existing) return null;

  let snapshot = existing.snapshot;
  if (patch.snapshot !== undefined) {
    snapshot = patch.snapshot;
  }

  let status = existing.status;
  let submittedAt = existing.submittedAt;

  if (patch.status !== undefined) {
    if (patch.status === "submitted") {
      status = "submitted";
      if (!submittedAt) {
        submittedAt = new Date().toISOString();
      }
    } else {
      status = "draft";
    }
  }

  const now = new Date().toISOString();
  const snapshotJson = JSON.stringify(snapshot);
  const res = db
    .prepare(
      `UPDATE submissions
       SET snapshot_json = ?, status = ?, submitted_at = ?, updated_at = ?
       WHERE owner_key = ? AND id = ?`,
    )
    .run(snapshotJson, status, submittedAt, now, ownerKey, id);
  if (res.changes === 0) return null;
  if (status !== existing.status) {
    recordStatusTransition(
      db,
      id,
      existing.status,
      status,
      ownerKey.startsWith("email:") ? ownerKey.slice(6) : ownerKey,
      status === "submitted" ? (submittedAt ?? now) : now,
    );
  }
  return getById(db, ownerKey, id);
}

export type DeleteSubmissionResult = "deleted" | "not_found" | "not_draft";

export function deleteSubmission(
  db: Database.Database,
  ownerKey: string,
  id: string,
): DeleteSubmissionResult {
  const existing = getById(db, ownerKey, id);
  if (!existing) return "not_found";
  if (existing.status !== "draft") return "not_draft";
  const res = db.prepare(`DELETE FROM submissions WHERE owner_key = ? AND id = ?`).run(ownerKey, id);
  return res.changes > 0 ? "deleted" : "not_found";
}

export interface AdminSavedActionDto extends SavedActionDto {
  ownerEmail: string;
}

interface AdminRow {
  id: string;
  cp_record_id: string;
  status: string;
  snapshot_json: string;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  owner_key: string;
  owner_email: string | null;
}

function rowToAdminDto(r: AdminRow): AdminSavedActionDto {
  const dto = rowToDto(r);
  const explicit = typeof r.owner_email === "string" ? r.owner_email.trim() : "";
  const email = explicit || (r.owner_key.startsWith("email:") ? r.owner_key.slice(6) : "");
  return { ...dto, ownerEmail: email };
}

/** Admin scope: list every submission across all owners (most-recent first). */
export function listAll(db: Database.Database): AdminSavedActionDto[] {
  const rows = db
    .prepare(
      `SELECT id, cp_record_id, status, snapshot_json, submitted_at, created_at, updated_at, owner_key, owner_email
       FROM submissions
       ORDER BY updated_at DESC`,
    )
    .all() as AdminRow[];
  return rows.map(rowToAdminDto);
}

/** Admin scope: fetch any submission by id regardless of owner. */
export function getAny(db: Database.Database, id: string): AdminSavedActionDto | null {
  const row = db
    .prepare(
      `SELECT id, cp_record_id, status, snapshot_json, submitted_at, created_at, updated_at, owner_key, owner_email
       FROM submissions WHERE id = ?`,
    )
    .get(id) as AdminRow | undefined;
  if (!row) return null;
  return rowToAdminDto(row);
}

/** Admin scope: patch any submission (snapshot and/or status) regardless of owner. */
export function patchAny(
  db: Database.Database,
  id: string,
  patch: PatchSubmissionBody,
): AdminSavedActionDto | null {
  const existing = getAny(db, id);
  if (!existing) return null;

  let snapshot = existing.snapshot;
  if (patch.snapshot !== undefined) {
    snapshot = patch.snapshot;
  }

  let status = existing.status;
  let submittedAt = existing.submittedAt;

  if (patch.status !== undefined) {
    if (patch.status === "submitted") {
      status = "submitted";
      if (!submittedAt) {
        submittedAt = new Date().toISOString();
      }
    } else {
      status = "draft";
    }
  }

  const now = new Date().toISOString();
  const snapshotJson = JSON.stringify(snapshot);
  const res = db
    .prepare(
      `UPDATE submissions
       SET snapshot_json = ?, status = ?, submitted_at = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(snapshotJson, status, submittedAt, now, id);
  if (res.changes === 0) return null;
  if (status !== existing.status) {
    recordStatusTransition(
      db,
      id,
      existing.status,
      status,
      existing.ownerEmail || null,
      status === "submitted" ? (submittedAt ?? now) : now,
    );
  }
  return getAny(db, id);
}
