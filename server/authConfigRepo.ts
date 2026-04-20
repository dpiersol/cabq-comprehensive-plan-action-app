import type Database from "better-sqlite3";

/**
 * Dynamic auth configuration managed in the DB. DB values override env when
 * present; env acts as a safe default / first-run seed.
 */
export interface AuthConfig {
  ssoEnabled: boolean;
  localEnabled: boolean;
  tenantId: string | null;
  clientId: string | null;
  audience: string | null;
  issuer: string | null;
  allowedEmailDomains: string[];
  adminRoleNames: string[];
  adminEmails: string[];
}

const KEYS = [
  "ssoEnabled",
  "localEnabled",
  "tenantId",
  "clientId",
  "audience",
  "issuer",
  "allowedEmailDomains",
  "adminRoleNames",
  "adminEmails",
] as const;

type KnownKey = (typeof KEYS)[number];
const KNOWN_KEYS = new Set<string>(KEYS);

function readAll(db: Database.Database): Partial<Record<KnownKey, string>> {
  const rows = db.prepare("SELECT key, value FROM auth_config").all() as {
    key: string;
    value: string | null;
  }[];
  const out: Partial<Record<KnownKey, string>> = {};
  for (const r of rows) {
    if (KNOWN_KEYS.has(r.key) && r.value !== null) {
      out[r.key as KnownKey] = r.value;
    }
  }
  return out;
}

function splitList(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function boolFrom(
  raw: string | undefined | null,
  envFallback: string | undefined,
  defaultValue: boolean,
): boolean {
  if (raw !== undefined && raw !== null && raw !== "") {
    return raw === "1" || raw.toLowerCase() === "true";
  }
  if (envFallback !== undefined && envFallback !== "") {
    return envFallback === "1" || envFallback.toLowerCase() === "true";
  }
  return defaultValue;
}

function stringFrom(raw: string | undefined | null, envFallback: string | undefined): string | null {
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  const e = envFallback?.trim();
  return e && e.length > 0 ? e : null;
}

function listFrom(
  raw: string | undefined | null,
  envFallback: string | undefined,
  defaultList: string[] = [],
): string[] {
  if (typeof raw === "string" && raw.trim()) return splitList(raw);
  if (envFallback && envFallback.trim()) return splitList(envFallback);
  return defaultList;
}

/**
 * Compute the effective auth configuration. DB values take precedence over
 * environment variables; environment variables act as the fallback / seed
 * values. Backwards-compatible with all pre-3.7 env-only deployments.
 */
export function getEffectiveAuthConfig(db: Database.Database): AuthConfig {
  const dbVals = readAll(db);
  const tenantId = stringFrom(dbVals.tenantId, process.env.AZURE_TENANT_ID);
  const clientId = stringFrom(dbVals.clientId, process.env.AZURE_CLIENT_ID);
  const audience = stringFrom(
    dbVals.audience,
    process.env.AZURE_AUDIENCE ?? process.env.AZURE_CLIENT_ID,
  );
  return {
    ssoEnabled: boolFrom(dbVals.ssoEnabled, undefined, Boolean(tenantId)),
    localEnabled: boolFrom(dbVals.localEnabled, undefined, true),
    tenantId,
    clientId,
    audience,
    issuer: stringFrom(dbVals.issuer, process.env.AZURE_ISSUER),
    allowedEmailDomains: listFrom(dbVals.allowedEmailDomains, process.env.ALLOWED_EMAIL_DOMAINS, [
      "cabq.gov",
    ]),
    adminRoleNames: listFrom(dbVals.adminRoleNames, process.env.ADMIN_ROLE_NAMES, [
      "comp-plan-admin",
      "Application.Admin",
      "Admin",
    ]),
    adminEmails: listFrom(dbVals.adminEmails, process.env.ADMIN_EMAILS, []).map((e) =>
      e.toLowerCase(),
    ),
  };
}

/** Partial update shape used by the admin API. */
export interface AuthConfigPatch {
  ssoEnabled?: boolean;
  localEnabled?: boolean;
  tenantId?: string | null;
  clientId?: string | null;
  audience?: string | null;
  issuer?: string | null;
  allowedEmailDomains?: string[];
  adminRoleNames?: string[];
  adminEmails?: string[];
}

const STRING_KEYS: KnownKey[] = ["tenantId", "clientId", "audience", "issuer"];
const LIST_KEYS: KnownKey[] = ["allowedEmailDomains", "adminRoleNames", "adminEmails"];
const BOOL_KEYS: KnownKey[] = ["ssoEnabled", "localEnabled"];

function setValue(
  db: Database.Database,
  key: KnownKey,
  value: string | null,
  actor: string | undefined,
): void {
  const now = new Date().toISOString();
  if (value === null) {
    db.prepare("DELETE FROM auth_config WHERE key = ?").run(key);
    db.prepare(
      "INSERT OR REPLACE INTO auth_config (key, value, updated_by, updated_at) VALUES (?, NULL, ?, ?)",
    ).run(key, actor ?? null, now);
    return;
  }
  db.prepare(
    "INSERT OR REPLACE INTO auth_config (key, value, updated_by, updated_at) VALUES (?, ?, ?, ?)",
  ).run(key, value, actor ?? null, now);
}

function clearKey(db: Database.Database, key: KnownKey): void {
  db.prepare("DELETE FROM auth_config WHERE key = ?").run(key);
}

export function applyAuthConfigPatch(
  db: Database.Database,
  patch: AuthConfigPatch,
  actor: string | undefined,
): AuthConfig {
  const tx = db.transaction(() => {
    for (const key of BOOL_KEYS) {
      const v = patch[key];
      if (v === undefined) continue;
      setValue(db, key, v ? "true" : "false", actor);
    }
    for (const key of STRING_KEYS) {
      const v = patch[key];
      if (v === undefined) continue;
      if (v === null || v === "") clearKey(db, key);
      else setValue(db, key, String(v).trim(), actor);
    }
    for (const key of LIST_KEYS) {
      const v = patch[key];
      if (v === undefined) continue;
      const normalised = Array.isArray(v)
        ? v.map((s) => s.trim()).filter(Boolean).join(",")
        : null;
      if (!normalised) clearKey(db, key);
      else setValue(db, key, normalised, actor);
    }
  });
  tx();
  return getEffectiveAuthConfig(db);
}
