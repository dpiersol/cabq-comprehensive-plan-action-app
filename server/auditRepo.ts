import type Database from "better-sqlite3";

export interface AuditEntry {
  id: number;
  actor: string | null;
  action: string;
  target: string | null;
  detail: string | null;
  at: string;
}

/** Append an entry. Fails silently (logs) — auth must not be blocked by audit write failures. */
export function recordAudit(
  db: Database.Database,
  entry: {
    actor?: string | null;
    action: string;
    target?: string | null;
    detail?: Record<string, unknown> | null;
  },
): void {
  try {
    db.prepare(
      "INSERT INTO auth_audit (actor, action, target, detail, at) VALUES (?, ?, ?, ?, ?)",
    ).run(
      entry.actor ?? null,
      entry.action,
      entry.target ?? null,
      entry.detail ? JSON.stringify(entry.detail) : null,
      new Date().toISOString(),
    );
  } catch (err) {
    console.warn("[auth-audit] failed to write entry", entry.action, err);
  }
}

export interface ListAuditOptions {
  limit?: number;
  beforeId?: number;
  action?: string;
}

export function listAudit(db: Database.Database, opts: ListAuditOptions = {}): AuditEntry[] {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.beforeId !== undefined) {
    where.push("id < ?");
    params.push(opts.beforeId);
  }
  if (opts.action) {
    where.push("action = ?");
    params.push(opts.action);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `SELECT id, actor, action, target, detail, at
         FROM auth_audit
         ${whereSql}
         ORDER BY id DESC
         LIMIT ?`,
    )
    .all(...params, limit) as AuditEntry[];
  return rows;
}
