import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

/** Mirrors client `SavedAction`; snapshot is validated at the HTTP boundary. */
export interface SavedActionDto {
  id: string;
  cpRecordId: string;
  createdAt: string;
  updatedAt: string;
  snapshot: unknown;
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

export function listByOwner(db: Database.Database, ownerKey: string): SavedActionDto[] {
  const rows = db
    .prepare(
      `SELECT id, cp_record_id, snapshot_json, created_at, updated_at
       FROM submissions WHERE owner_key = ?
       ORDER BY updated_at DESC`,
    )
    .all(ownerKey) as {
      id: string;
      cp_record_id: string;
      snapshot_json: string;
      created_at: string;
      updated_at: string;
    }[];

  return rows.map((r) => ({
    id: r.id,
    cpRecordId: r.cp_record_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    snapshot: JSON.parse(r.snapshot_json) as unknown,
  }));
}

export function getById(
  db: Database.Database,
  ownerKey: string,
  id: string,
): SavedActionDto | null {
  const row = db
    .prepare(
      `SELECT id, cp_record_id, snapshot_json, created_at, updated_at
       FROM submissions WHERE owner_key = ? AND id = ?`,
    )
    .get(ownerKey, id) as
    | {
        id: string;
        cp_record_id: string;
        snapshot_json: string;
        created_at: string;
        updated_at: string;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    cpRecordId: row.cp_record_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    snapshot: JSON.parse(row.snapshot_json) as DraftSnapshot,
  };
}

export function insertSubmission(
  db: Database.Database,
  ownerKey: string,
  snapshot: unknown,
): SavedActionDto {
  const id = randomUUID();
  const now = new Date().toISOString();
  const cpRecordId = nextCpRecordId(db, ownerKey);
  const snapshotJson = JSON.stringify(snapshot);
  db.prepare(
    `INSERT INTO submissions (id, owner_key, cp_record_id, status, snapshot_json, created_at, updated_at)
     VALUES (?, ?, ?, 'draft', ?, ?, ?)`,
  ).run(id, ownerKey, cpRecordId, snapshotJson, now, now);
  return {
    id,
    cpRecordId,
    createdAt: now,
    updatedAt: now,
    snapshot,
  };
}

export function updateSubmission(
  db: Database.Database,
  ownerKey: string,
  id: string,
  snapshot: unknown,
): SavedActionDto | null {
  const now = new Date().toISOString();
  const snapshotJson = JSON.stringify(snapshot);
  const res = db
    .prepare(
      `UPDATE submissions SET snapshot_json = ?, updated_at = ?
       WHERE owner_key = ? AND id = ?`,
    )
    .run(snapshotJson, now, ownerKey, id);
  if (res.changes === 0) return null;
  return getById(db, ownerKey, id);
}

export function deleteSubmission(db: Database.Database, ownerKey: string, id: string): boolean {
  const res = db.prepare(`DELETE FROM submissions WHERE owner_key = ? AND id = ?`).run(ownerKey, id);
  return res.changes > 0;
}
