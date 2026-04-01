import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";


const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const defaultPath = resolve(repoRoot, "data/workflow.db");

export function getDbPath(): string {
  return process.env.WORKFLOW_DB_PATH ?? defaultPath;
}

export type AppDb = BetterSQLite3Database<typeof schema>;

export function initDb(): { sqlite: Database.Database; db: AppDb } {
  const sqlite = openSqliteRaw();
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

/** Run once on startup: create tables if missing (MVP without migration files). */
export function ensureTables(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      display_name TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY NOT NULL,
      snapshot_json TEXT NOT NULL,
      status TEXT NOT NULL,
      current_queue TEXT NOT NULL,
      fi_requested_by TEXT,
      workflow_comments TEXT,
      council_to_planning_comments TEXT,
      fi_access_token TEXT,
      created_by_user_id TEXT,
      created_at INTEGER NOT NULL,
      updated_by_user_id TEXT,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workflow_events (
      id TEXT PRIMARY KEY NOT NULL,
      submission_id TEXT NOT NULL,
      from_status TEXT NOT NULL,
      to_status TEXT NOT NULL,
      action TEXT NOT NULL,
      actor_user_id TEXT,
      payload_json TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY NOT NULL,
      submission_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      to_addresses TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_submissions_queue ON submissions(current_queue);
    CREATE INDEX IF NOT EXISTS idx_events_submission ON workflow_events(submission_id);
  `);
}

export function openSqliteRaw() {
  const path = getDbPath();
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  ensureTables(sqlite);
  return sqlite;
}

