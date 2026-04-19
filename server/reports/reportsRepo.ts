/**
 * Aggregation queries that power the Admin → Security → Reports pages.
 *
 * Every helper here is READ-ONLY, runs against the primary SQLite DB, and
 * returns a shape that's stable enough to hand straight to the browser.
 *
 * Phase 1 (v4.0.0):
 *   - getSubmissionsOverview() → Report 1 (Submissions Overview)
 *   - getUserActivity()        → Report 2 (User Activity)
 *
 * Phase 2 (v4.1.0) will add getAuthSecurity() + getCoverageGaps().
 * Phase 3 (v4.2.0) will add getSubmissionLifecycle() (needs migration 5).
 */

import type Database from "better-sqlite3";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function iso(d: Date): string {
  return d.toISOString();
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Groups ISO timestamp rows into week buckets keyed by Monday (YYYY-MM-DD).
 * Buckets with zero submissions are included so chart rendering is simpler.
 */
function weeklyBuckets(
  timestamps: string[],
  weeks: number,
): { weekStart: string; count: number }[] {
  const buckets = new Map<string, number>();
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  // Back up to the most recent Monday.
  const dowSun0 = now.getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (dowSun0 + 6) % 7;
  const thisMonday = new Date(now);
  thisMonday.setUTCDate(thisMonday.getUTCDate() - daysSinceMonday);

  for (let i = weeks - 1; i >= 0; i--) {
    const wk = new Date(thisMonday);
    wk.setUTCDate(wk.getUTCDate() - i * 7);
    buckets.set(ymd(wk), 0);
  }

  for (const ts of timestamps) {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) continue;
    d.setUTCHours(0, 0, 0, 0);
    const dow = d.getUTCDay();
    const dsm = (dow + 6) % 7;
    const monday = new Date(d);
    monday.setUTCDate(monday.getUTCDate() - dsm);
    const key = ymd(monday);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }

  return [...buckets.entries()].map(([weekStart, count]) => ({ weekStart, count }));
}

// ---------------------------------------------------------------------------
// Report 1 — Submissions Overview
// ---------------------------------------------------------------------------

export interface SubmissionsOverviewKpis {
  total: number;
  draft: number;
  submitted: number;
  createdLast7d: number;
  createdLast30d: number;
  submittedLast7d: number;
  submittedLast30d: number;
}

export interface TopGoalEntry {
  chapterIdx: number;
  goalIdx: number;
  count: number;
}

export interface SubmissionsOverview {
  generatedAt: string;
  kpis: SubmissionsOverviewKpis;
  /** Monday-keyed weekly buckets for the last N weeks (default 13 ≈ 90 days). */
  weekly: { weekStart: string; count: number }[];
  /** Top 10 (chapter, goal) pairs across ALL submissions, most-cited first. */
  topGoals: TopGoalEntry[];
  /** Number of submissions whose snapshot didn't parse / had no planItems. */
  unmapped: number;
}

export function getSubmissionsOverview(
  db: Database.Database,
  opts: { weeks?: number } = {},
): SubmissionsOverview {
  const weeks = opts.weeks ?? 13;
  const now = new Date();
  const ago7 = iso(daysAgo(7));
  const ago30 = iso(daysAgo(30));

  type Row = {
    status: string;
    snapshot_json: string;
    submitted_at: string | null;
    created_at: string;
  };
  const rows = db
    .prepare(
      `SELECT status, snapshot_json, submitted_at, created_at
       FROM submissions`,
    )
    .all() as Row[];

  let draft = 0;
  let submitted = 0;
  let createdLast7d = 0;
  let createdLast30d = 0;
  let submittedLast7d = 0;
  let submittedLast30d = 0;
  const submittedTimestamps: string[] = [];
  const goalCounts = new Map<string, TopGoalEntry>();
  let unmapped = 0;

  for (const r of rows) {
    if (r.status === "submitted") submitted++;
    else draft++;

    if (r.created_at > ago30) createdLast30d++;
    if (r.created_at > ago7) createdLast7d++;

    if (r.submitted_at) {
      submittedTimestamps.push(r.submitted_at);
      if (r.submitted_at > ago30) submittedLast30d++;
      if (r.submitted_at > ago7) submittedLast7d++;
    }

    // Snapshot is a JSON string we wrote ourselves, but be defensive.
    let planItems: { chapterIdx?: number; goalIdx?: number }[] = [];
    try {
      const parsed = JSON.parse(r.snapshot_json) as { planItems?: unknown };
      if (parsed && Array.isArray(parsed.planItems)) {
        planItems = parsed.planItems as typeof planItems;
      }
    } catch {
      unmapped++;
      continue;
    }

    if (planItems.length === 0) {
      unmapped++;
      continue;
    }

    for (const pi of planItems) {
      const ci = typeof pi.chapterIdx === "number" ? pi.chapterIdx : -1;
      const gi = typeof pi.goalIdx === "number" ? pi.goalIdx : -1;
      if (ci < 0 || gi < 0) continue;
      const key = `${ci}:${gi}`;
      const prev = goalCounts.get(key);
      if (prev) prev.count += 1;
      else goalCounts.set(key, { chapterIdx: ci, goalIdx: gi, count: 1 });
    }
  }

  const topGoals = [...goalCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    generatedAt: iso(now),
    kpis: {
      total: rows.length,
      draft,
      submitted,
      createdLast7d,
      createdLast30d,
      submittedLast7d,
      submittedLast30d,
    },
    weekly: weeklyBuckets(submittedTimestamps, weeks),
    topGoals,
    unmapped,
  };
}

// ---------------------------------------------------------------------------
// Report 2 — User Activity
// ---------------------------------------------------------------------------

export interface UserActivityLocalRow {
  id: string;
  username: string;
  email: string;
  displayName: string;
  roles: string[];
  isActive: boolean;
  isLocked: boolean;
  lastLoginAt: string | null;
  daysSinceLogin: number | null;
  submissionsTotal: number;
  submissionsSubmitted: number;
  submissionsDraft: number;
  lastSubmissionAt: string | null;
}

export interface UserActivityNonLocalRow {
  email: string;
  submissionsTotal: number;
  submissionsSubmitted: number;
  submissionsDraft: number;
  lastSubmissionAt: string | null;
}

export interface UserActivityReport {
  generatedAt: string;
  localUsers: UserActivityLocalRow[];
  nonLocalSubmitters: UserActivityNonLocalRow[];
  totals: {
    localUsers: number;
    activeLocalUsers: number;
    admins: number;
    dormant90d: number;
  };
}

export function getUserActivity(
  db: Database.Database,
  adminRoleNames: string[],
): UserActivityReport {
  const now = new Date();
  const ago90 = iso(daysAgo(90));

  type LocalUserRow = {
    id: string;
    username: string;
    email: string;
    display_name: string;
    is_active: number;
    locked_until: string | null;
    last_login_at: string | null;
  };
  const users = db
    .prepare(
      `SELECT id, username, email, display_name, is_active, locked_until, last_login_at
       FROM local_users
       ORDER BY lower(username)`,
    )
    .all() as LocalUserRow[];

  type RoleRow = { user_id: string; role_name: string };
  const rolesRows = db
    .prepare(`SELECT user_id, role_name FROM user_roles`)
    .all() as RoleRow[];
  const rolesByUser = new Map<string, string[]>();
  for (const r of rolesRows) {
    const list = rolesByUser.get(r.user_id) ?? [];
    list.push(r.role_name);
    rolesByUser.set(r.user_id, list);
  }

  // Aggregate submissions by lower(owner_email). Ignore rows with no email.
  type SubmissionAggRow = {
    email: string;
    total: number;
    submitted: number;
    draft: number;
    last_at: string;
  };
  const subsByEmail = db
    .prepare(
      `SELECT lower(coalesce(owner_email, '')) AS email,
              count(*) AS total,
              sum(case when status = 'submitted' then 1 else 0 end) AS submitted,
              sum(case when status = 'draft'     then 1 else 0 end) AS draft,
              max(updated_at) AS last_at
         FROM submissions
        WHERE coalesce(owner_email, '') <> ''
        GROUP BY lower(coalesce(owner_email, ''))`,
    )
    .all() as SubmissionAggRow[];
  const subsMap = new Map<string, SubmissionAggRow>();
  for (const r of subsByEmail) subsMap.set(r.email, r);

  const adminRoleSet = new Set(adminRoleNames.map((r) => r.toLowerCase()));
  const nowMs = now.getTime();

  const localUsers: UserActivityLocalRow[] = users.map((u) => {
    const roles = (rolesByUser.get(u.id) ?? []).sort();
    const subs = subsMap.get(u.email.toLowerCase());
    const lastLogin = u.last_login_at;
    const dsl =
      lastLogin && !Number.isNaN(new Date(lastLogin).getTime())
        ? Math.floor((nowMs - new Date(lastLogin).getTime()) / 86_400_000)
        : null;
    const lockedUntil = u.locked_until ? new Date(u.locked_until).getTime() : 0;

    // Mark used: ensure admin users show regardless of submission activity.
    void adminRoleSet;

    return {
      id: u.id,
      username: u.username,
      email: u.email,
      displayName: u.display_name,
      roles,
      isActive: u.is_active === 1,
      isLocked: lockedUntil > nowMs,
      lastLoginAt: lastLogin,
      daysSinceLogin: dsl,
      submissionsTotal: subs?.total ?? 0,
      submissionsSubmitted: subs?.submitted ?? 0,
      submissionsDraft: subs?.draft ?? 0,
      lastSubmissionAt: subs?.last_at ?? null,
    };
  });

  const localEmails = new Set(users.map((u) => u.email.toLowerCase()));
  const nonLocalSubmitters: UserActivityNonLocalRow[] = subsByEmail
    .filter((r) => !localEmails.has(r.email))
    .map((r) => ({
      email: r.email,
      submissionsTotal: r.total,
      submissionsSubmitted: r.submitted,
      submissionsDraft: r.draft,
      lastSubmissionAt: r.last_at,
    }))
    .sort((a, b) => b.submissionsTotal - a.submissionsTotal);

  const totals = {
    localUsers: localUsers.length,
    activeLocalUsers: localUsers.filter((u) => u.isActive && !u.isLocked).length,
    admins: localUsers.filter((u) =>
      u.roles.some((r) => adminRoleSet.has(r.toLowerCase())),
    ).length,
    dormant90d: localUsers.filter(
      (u) => !u.lastLoginAt || u.lastLoginAt < ago90,
    ).length,
  };

  return {
    generatedAt: iso(now),
    localUsers,
    nonLocalSubmitters,
    totals,
  };
}
