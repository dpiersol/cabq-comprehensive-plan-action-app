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
 * Phase 2 (v4.1.0):
 *   - getAuthSecurity()        → Report 3 (Authentication & Security)
 *   - getAuthAuditCsv()        → CSV export for Report 3
 *   - getCoverageGaps()        → Report 5 (Coverage / Gap Analysis)
 *
 * Phase 3 (v4.2.0) will add getSubmissionLifecycle() (needs migration 5).
 */

import type Database from "better-sqlite3";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

// ---------------------------------------------------------------------------
// Report 3 — Authentication & Security
// ---------------------------------------------------------------------------

/**
 * Grouping of the raw `auth_audit.action` strings into high-level categories
 * the UI displays as a stacked daily chart. Keep these in sync with the
 * actual `action` values written by `localAuthRoutes` / `authConfigRoutes`
 * / `bootstrapAdmin`.
 */
const AUDIT_CATEGORIES: Record<string, string[]> = {
  login_success: ["local_login_success"],
  login_failed: ["local_login_failed"],
  password_change: [
    "local_change_password_success",
    "local_change_password_failed",
    "admin_user_reset_password",
  ],
  user_change: [
    "admin_user_create",
    "admin_user_update",
    "admin_user_delete",
    "bootstrap_admin_created",
  ],
  role_change: [
    "admin_role_create",
    "admin_role_delete",
    "admin_user_role_add",
    "admin_user_role_remove",
  ],
  sso_config: [
    "admin_auth_config_update",
    "admin_auth_config_test_sso_success",
    "admin_auth_config_test_sso_failed",
  ],
};
const AUDIT_ACTION_TO_CAT = new Map<string, string>();
for (const [cat, actions] of Object.entries(AUDIT_CATEGORIES)) {
  for (const a of actions) AUDIT_ACTION_TO_CAT.set(a, cat);
}
export const AUTH_REPORT_CATEGORIES = Object.keys(AUDIT_CATEGORIES);

export interface AuthSecuritySummary {
  generatedAt: string;
  /** How many days of data are in `daily` (inclusive, ending today UTC). */
  windowDays: number;
  totals: {
    loginSuccess: number;
    loginFailed: number;
    passwordChange: number;
    userChange: number;
    roleChange: number;
    ssoConfig: number;
    lockouts: number;
  };
  /** One entry per day (YYYY-MM-DD), with a count per category. */
  daily: { date: string; counts: Record<string, number> }[];
  /** Identifiers with the most failed logins over the window. */
  failureWatchlist: {
    actor: string;
    failures: number;
    lastAt: string;
    distinctIps: number;
  }[];
  /** Most recent audit rows (for a "latest activity" tail). */
  recent: {
    id: number;
    at: string;
    action: string;
    category: string | null;
    actor: string | null;
    target: string | null;
    detail: unknown;
  }[];
}

interface AuthAuditRow {
  id: number;
  at: string;
  action: string;
  actor: string | null;
  target: string | null;
  detail: string | null;
}

function parseDetail(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function getAuthSecurity(
  db: Database.Database,
  opts: { days?: number } = {},
): AuthSecuritySummary {
  const windowDays = Math.min(Math.max(opts.days ?? 30, 7), 180);
  const cutoff = daysAgo(windowDays - 1); // include today
  const cutoffIso = iso(cutoff);

  const rows = db
    .prepare(
      `SELECT id, at, action, actor, target, detail
         FROM auth_audit
        WHERE at >= ?
        ORDER BY id DESC`,
    )
    .all(cutoffIso) as AuthAuditRow[];

  const totals = {
    loginSuccess: 0,
    loginFailed: 0,
    passwordChange: 0,
    userChange: 0,
    roleChange: 0,
    ssoConfig: 0,
    lockouts: 0,
  };

  // Pre-build YYYY-MM-DD keys for each day in the window so chart always
  // shows zero-filled days.
  const dayKeys: string[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = daysAgo(i);
    dayKeys.push(ymd(d));
  }
  const emptyCounts = () => {
    const o: Record<string, number> = {};
    for (const c of AUTH_REPORT_CATEGORIES) o[c] = 0;
    return o;
  };
  const dayMap = new Map<string, Record<string, number>>();
  for (const k of dayKeys) dayMap.set(k, emptyCounts());

  const failMap = new Map<
    string,
    { actor: string; failures: number; lastAt: string; ips: Set<string> }
  >();

  for (const r of rows) {
    const cat = AUDIT_ACTION_TO_CAT.get(r.action) ?? null;

    if (cat === "login_success") totals.loginSuccess++;
    else if (cat === "login_failed") totals.loginFailed++;
    else if (cat === "password_change") totals.passwordChange++;
    else if (cat === "user_change") totals.userChange++;
    else if (cat === "role_change") totals.roleChange++;
    else if (cat === "sso_config") totals.ssoConfig++;

    // "Lockout" is a login_failed with reason === 'locked'.
    if (r.action === "local_login_failed") {
      const d = parseDetail(r.detail);
      if (d && typeof d === "object" && (d as { reason?: unknown }).reason === "locked") {
        totals.lockouts++;
      }
      const actorKey = (r.actor ?? "(unknown)").toLowerCase();
      const fm = failMap.get(actorKey) ?? {
        actor: r.actor ?? "(unknown)",
        failures: 0,
        lastAt: r.at,
        ips: new Set<string>(),
      };
      fm.failures += 1;
      if (r.at > fm.lastAt) fm.lastAt = r.at;
      if (d && typeof d === "object") {
        const ip = (d as { ip?: unknown }).ip;
        if (typeof ip === "string" && ip) fm.ips.add(ip);
      }
      failMap.set(actorKey, fm);
    }

    if (cat) {
      const key = ymd(new Date(r.at));
      const bucket = dayMap.get(key);
      if (bucket) bucket[cat] = (bucket[cat] ?? 0) + 1;
    }
  }

  const failureWatchlist = [...failMap.values()]
    .sort((a, b) => b.failures - a.failures)
    .slice(0, 15)
    .map((f) => ({
      actor: f.actor,
      failures: f.failures,
      lastAt: f.lastAt,
      distinctIps: f.ips.size,
    }));

  const recent = rows.slice(0, 25).map((r) => ({
    id: r.id,
    at: r.at,
    action: r.action,
    category: AUDIT_ACTION_TO_CAT.get(r.action) ?? null,
    actor: r.actor,
    target: r.target,
    detail: parseDetail(r.detail),
  }));

  return {
    generatedAt: iso(new Date()),
    windowDays,
    totals,
    daily: dayKeys.map((date) => ({
      date,
      counts: dayMap.get(date) ?? emptyCounts(),
    })),
    failureWatchlist,
    recent,
  };
}

/** Escape a value for RFC 4180-ish CSV (quoted when needed, quotes doubled). */
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Returns a full CSV string of the auth audit log for a rolling window.
 * Intended for `Content-Type: text/csv` HTTP responses.
 */
export function getAuthAuditCsv(
  db: Database.Database,
  opts: { days?: number } = {},
): string {
  const windowDays = Math.min(Math.max(opts.days ?? 30, 1), 365);
  const cutoffIso = iso(daysAgo(windowDays - 1));
  const rows = db
    .prepare(
      `SELECT id, at, action, actor, target, detail
         FROM auth_audit
        WHERE at >= ?
        ORDER BY id DESC`,
    )
    .all(cutoffIso) as AuthAuditRow[];

  const header = ["id", "at", "action", "category", "actor", "target", "detail"];
  const lines: string[] = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.at,
        r.action,
        AUDIT_ACTION_TO_CAT.get(r.action) ?? "",
        r.actor,
        r.target,
        r.detail,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// Report 5 — Coverage / Gap Analysis
// ---------------------------------------------------------------------------

// Shape subset used by coverage analysis. Matches src/types.ts PlanData.
interface CovPolicy {
  policyNumber?: string;
  policyDescription?: string;
}
interface CovGoalDetail {
  detail?: string;
  policies?: CovPolicy[];
}
interface CovGoal {
  goalNumber?: string;
  goalDescription?: string;
  goalDetails?: CovGoalDetail[];
}
interface CovChapter {
  chapterNumber?: number | string;
  chapterTitle?: string;
  goals?: CovGoal[];
}
interface CovPlanData {
  chapters: CovChapter[];
}

let cachedPlan: CovPlanData | null = null;
let testOverrideActive = false;

function planJsonCandidates(): string[] {
  // __dirname for ESM via import.meta.url.
  const here = dirname(fileURLToPath(import.meta.url));
  // server/reports/reportsRepo.ts → ../../public/data and ../../dist/data
  return [
    join(here, "..", "..", "public", "data", "comprehensive-plan-hierarchy.json"),
    join(here, "..", "..", "dist", "data", "comprehensive-plan-hierarchy.json"),
    join(process.cwd(), "public", "data", "comprehensive-plan-hierarchy.json"),
    join(process.cwd(), "dist", "data", "comprehensive-plan-hierarchy.json"),
  ];
}

function loadPlanFromDisk(): CovPlanData | null {
  for (const p of planJsonCandidates()) {
    if (existsSync(p)) {
      try {
        const raw = readFileSync(p, "utf8");
        const parsed = JSON.parse(raw) as CovPlanData;
        if (parsed && Array.isArray(parsed.chapters)) return parsed;
      } catch {
        /* try next */
      }
    }
  }
  return null;
}

/**
 * Test seam so unit tests can inject a fake hierarchy (or `null` to disable
 * the disk fallback). Call `resetPlanCacheForTests()` to return to normal.
 */
export function setPlanDataForTests(plan: CovPlanData | null): void {
  cachedPlan = plan;
  testOverrideActive = true;
}

export function resetPlanCacheForTests(): void {
  cachedPlan = null;
  testOverrideActive = false;
}

function getPlan(): CovPlanData | null {
  if (testOverrideActive) return cachedPlan;
  if (cachedPlan) return cachedPlan;
  cachedPlan = loadPlanFromDisk();
  return cachedPlan;
}

export interface CoverageUncoveredGoal {
  chapterIdx: number;
  goalIdx: number;
  chapterName: string;
  goalName: string;
}

export interface CoverageChapterRow {
  chapterIdx: number;
  chapterName: string;
  goalsTotal: number;
  goalsCovered: number;
  submissions: number;
}

export interface CoverageReport {
  generatedAt: string;
  planLoaded: boolean;
  totals: {
    chapters: number;
    goals: number;
    policies: number;
    goalsCovered: number;
    policiesCovered: number;
    goalsUncovered: number;
    policiesUncovered: number;
    submissionsMapped: number;
    submissionsUnmapped: number;
  };
  byChapter: CoverageChapterRow[];
  uncoveredGoals: CoverageUncoveredGoal[];
  topGoals: (CoverageUncoveredGoal & { count: number })[];
}

export function getCoverageGaps(db: Database.Database): CoverageReport {
  const plan = getPlan();
  if (!plan) {
    return {
      generatedAt: iso(new Date()),
      planLoaded: false,
      totals: {
        chapters: 0,
        goals: 0,
        policies: 0,
        goalsCovered: 0,
        policiesCovered: 0,
        goalsUncovered: 0,
        policiesUncovered: 0,
        submissionsMapped: 0,
        submissionsUnmapped: 0,
      },
      byChapter: [],
      uncoveredGoals: [],
      topGoals: [],
    };
  }

  // Build the plan universe: every (chapterIdx, goalIdx) and (ch,g,gd,p).
  const goalUniverse = new Map<
    string,
    { chapterIdx: number; goalIdx: number; chapterName: string; goalName: string }
  >();
  const policyUniverse = new Set<string>();
  const chapterInfo = new Map<
    number,
    { chapterName: string; goalsTotal: number }
  >();

  plan.chapters.forEach((ch, ci) => {
    const chapterName = `Ch ${ch.chapterNumber ?? ci} · ${ch.chapterTitle ?? ""}`.trim();
    const goals = ch.goals ?? [];
    chapterInfo.set(ci, { chapterName, goalsTotal: goals.length });
    goals.forEach((g, gi) => {
      const goalName = `${g.goalNumber ?? gi}${
        g.goalDescription ? " · " + g.goalDescription : ""
      }`;
      goalUniverse.set(`${ci}:${gi}`, {
        chapterIdx: ci,
        goalIdx: gi,
        chapterName,
        goalName,
      });
      (g.goalDetails ?? []).forEach((gd, gdi) => {
        (gd.policies ?? []).forEach((_, pi) => {
          policyUniverse.add(`${ci}:${gi}:${gdi}:${pi}`);
        });
      });
    });
  });

  type SubRow = { snapshot_json: string };
  const subs = db
    .prepare(`SELECT snapshot_json FROM submissions`)
    .all() as SubRow[];

  const goalCounts = new Map<string, number>();
  const policyCounts = new Map<string, number>();
  const chapterSubmissionCounts = new Map<number, number>();
  let mapped = 0;
  let unmapped = 0;

  for (const s of subs) {
    let planItems: {
      chapterIdx?: number;
      goalIdx?: number;
      goalDetailIdx?: number;
      policyIdx?: number;
    }[] = [];
    try {
      const parsed = JSON.parse(s.snapshot_json) as { planItems?: unknown };
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
    mapped++;
    const chaptersHitByThisSub = new Set<number>();
    for (const pi of planItems) {
      const ci = typeof pi.chapterIdx === "number" ? pi.chapterIdx : -1;
      const gi = typeof pi.goalIdx === "number" ? pi.goalIdx : -1;
      if (ci < 0 || gi < 0) continue;
      const goalKey = `${ci}:${gi}`;
      goalCounts.set(goalKey, (goalCounts.get(goalKey) ?? 0) + 1);
      chaptersHitByThisSub.add(ci);
      const gdi = typeof pi.goalDetailIdx === "number" ? pi.goalDetailIdx : -1;
      const pIdx = typeof pi.policyIdx === "number" ? pi.policyIdx : -1;
      if (gdi >= 0 && pIdx >= 0) {
        const polKey = `${ci}:${gi}:${gdi}:${pIdx}`;
        policyCounts.set(polKey, (policyCounts.get(polKey) ?? 0) + 1);
      }
    }
    for (const ci of chaptersHitByThisSub) {
      chapterSubmissionCounts.set(ci, (chapterSubmissionCounts.get(ci) ?? 0) + 1);
    }
  }

  const goalsCovered = [...goalCounts.keys()].filter((k) =>
    goalUniverse.has(k),
  ).length;
  const policiesCovered = [...policyCounts.keys()].filter((k) =>
    policyUniverse.has(k),
  ).length;

  const uncoveredGoals: CoverageUncoveredGoal[] = [];
  for (const [key, info] of goalUniverse.entries()) {
    if (!goalCounts.has(key)) {
      uncoveredGoals.push(info);
    }
  }
  uncoveredGoals.sort(
    (a, b) =>
      a.chapterIdx - b.chapterIdx || a.goalIdx - b.goalIdx,
  );

  const byChapter: CoverageChapterRow[] = [];
  for (const [chapterIdx, info] of chapterInfo.entries()) {
    let covered = 0;
    for (let gi = 0; gi < info.goalsTotal; gi++) {
      if (goalCounts.has(`${chapterIdx}:${gi}`)) covered++;
    }
    byChapter.push({
      chapterIdx,
      chapterName: info.chapterName,
      goalsTotal: info.goalsTotal,
      goalsCovered: covered,
      submissions: chapterSubmissionCounts.get(chapterIdx) ?? 0,
    });
  }
  byChapter.sort((a, b) => a.chapterIdx - b.chapterIdx);

  const topGoals = [...goalCounts.entries()]
    .filter(([k]) => goalUniverse.has(k))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k, count]) => {
      const info = goalUniverse.get(k)!;
      return { ...info, count };
    });

  const totals = {
    chapters: chapterInfo.size,
    goals: goalUniverse.size,
    policies: policyUniverse.size,
    goalsCovered,
    policiesCovered,
    goalsUncovered: goalUniverse.size - goalsCovered,
    policiesUncovered: policyUniverse.size - policiesCovered,
    submissionsMapped: mapped,
    submissionsUnmapped: unmapped,
  };

  return {
    generatedAt: iso(new Date()),
    planLoaded: true,
    totals,
    byChapter,
    uncoveredGoals,
    topGoals,
  };
}
