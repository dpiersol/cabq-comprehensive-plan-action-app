import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

let singleton: Database.Database | null = null;

export function getDatabasePath(): string {
  if (process.env.VITEST) return ":memory:";
  const raw = process.env.SQLITE_PATH;
  if (raw && raw.trim()) return raw.trim();
  return join(process.cwd(), "data", "submissions.sqlite");
}

export function applyMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL
    );
  `);
  const applied = new Set(
    db
      .prepare("SELECT version FROM schema_migrations")
      .all()
      .map((r) => (r as { version: number }).version),
  );

  if (!applied.has(1)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY NOT NULL,
        owner_key TEXT NOT NULL,
        cp_record_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        snapshot_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_submissions_owner_updated
        ON submissions (owner_key, updated_at DESC);
    `);
    db.prepare("INSERT INTO schema_migrations (version) VALUES (1)").run();
  }

  if (!applied.has(2)) {
    try {
      db.exec(`ALTER TABLE submissions ADD COLUMN submitted_at TEXT;`);
    } catch {
      /* column may exist */
    }
    db.prepare("INSERT INTO schema_migrations (version) VALUES (2)").run();
  }

  if (!applied.has(3)) {
    try {
      db.exec(`ALTER TABLE submissions ADD COLUMN owner_email TEXT;`);
    } catch {
      /* column may exist */
    }
    db.prepare("INSERT INTO schema_migrations (version) VALUES (3)").run();
  }
}

/** Single connection; call once at process start (and in tests per buildServer). */
export function openDatabase(): Database.Database {
  if (singleton) return singleton;
  const path = getDatabasePath();
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
  singleton = db;
  return db;
}

/** Isolated DB for tests (each call is a fresh :memory: database). */
export function createMemoryDatabase(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  applyMigrations(db);
  return db;
}

/** Close and clear singleton (tests). */
export function closeDatabase(): void {
  if (singleton) {
    try {
      singleton.close();
    } catch {
      /* already closed */
    }
    singleton = null;
  }
}

/** Reset singleton without closing file (tests use :memory: per process). */
export function resetDatabaseSingleton(): void {
  singleton = null;
}
