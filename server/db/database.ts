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

  if (!applied.has(4)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS local_users (
        id TEXT PRIMARY KEY NOT NULL,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        must_change_password INTEGER NOT NULL DEFAULT 0,
        last_login_at TEXT,
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_local_users_username_lower
        ON local_users (lower(username));
      CREATE INDEX IF NOT EXISTS idx_local_users_email_lower
        ON local_users (lower(email));

      CREATE TABLE IF NOT EXISTS roles (
        name TEXT PRIMARY KEY NOT NULL,
        description TEXT,
        is_builtin INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS user_roles (
        user_id TEXT NOT NULL,
        role_name TEXT NOT NULL,
        assigned_by TEXT,
        assigned_at TEXT NOT NULL,
        PRIMARY KEY (user_id, role_name),
        FOREIGN KEY (user_id) REFERENCES local_users(id) ON DELETE CASCADE,
        FOREIGN KEY (role_name) REFERENCES roles(name) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS auth_config (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT,
        updated_by TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS auth_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor TEXT,
        action TEXT NOT NULL,
        target TEXT,
        detail TEXT,
        at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_auth_audit_at ON auth_audit (at DESC);
    `);

    const now = new Date().toISOString();
    const insertRole = db.prepare(
      "INSERT OR IGNORE INTO roles (name, description, is_builtin) VALUES (?, ?, 1)",
    );
    insertRole.run("comp-plan-admin", "Administers the Comprehensive Plan Action app.");
    insertRole.run("comp-plan-user", "Standard authenticated user.");

    db.prepare("INSERT INTO schema_migrations (version) VALUES (4)").run();
    void now;
  }

  if (!applied.has(5)) {
    // submission_status_history powers Report #4 (Lifecycle / Turnaround).
    // Each row is a transition event, recorded synchronously inside the same
    // write path that changes submissions.status. Backfilled below with the
    // best facts available from the live submissions table so the report is
    // meaningful immediately after deploy even for data that predates v4.2.
    db.exec(`
      CREATE TABLE IF NOT EXISTS submission_status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT NOT NULL,
        actor TEXT,
        at TEXT NOT NULL,
        FOREIGN KEY (submission_id)
          REFERENCES submissions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_submission_status_history_sub
        ON submission_status_history (submission_id, at);
      CREATE INDEX IF NOT EXISTS idx_submission_status_history_at
        ON submission_status_history (at);
    `);

    // Backfill: every existing submission gets a synthesized "created as
    // draft" event at created_at, and if it's now submitted, a second
    // "draft -> submitted" event at submitted_at (falling back to
    // updated_at if submitted_at is null, which should be rare).
    const rows = db
      .prepare(
        `SELECT id, status, created_at, submitted_at, updated_at, owner_email
           FROM submissions`,
      )
      .all() as {
      id: string;
      status: string;
      created_at: string;
      submitted_at: string | null;
      updated_at: string;
      owner_email: string | null;
    }[];
    const ins = db.prepare(
      `INSERT INTO submission_status_history
         (submission_id, from_status, to_status, actor, at)
       VALUES (?, ?, ?, ?, ?)`,
    );
    const tx = db.transaction(() => {
      for (const r of rows) {
        ins.run(r.id, null, "draft", r.owner_email, r.created_at);
        if (r.status === "submitted") {
          ins.run(
            r.id,
            "draft",
            "submitted",
            r.owner_email,
            r.submitted_at ?? r.updated_at,
          );
        }
      }
    });
    tx();

    db.prepare("INSERT INTO schema_migrations (version) VALUES (5)").run();
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
