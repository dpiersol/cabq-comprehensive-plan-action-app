import type { Configuration } from "@azure/msal-browser";
import { isMockAuthMode } from "../auth/entraEligibility";

/**
 * MSAL configuration for Azure Entra ID (single-tenant SPA).
 *
 * Values are resolved in this order:
 *   1. Admin-saved values from the DB, served by `GET /api/auth/config`.
 *   2. Build-time env vars (`VITE_AZURE_CLIENT_ID`, `VITE_AZURE_TENANT_ID`,
 *      optional `VITE_AZURE_REDIRECT_URI`).
 *   3. The all-zeros GUID placeholder (which will reject at Entra as
 *      `AADSTS700038`, but that's the correct behaviour when nothing has
 *      been configured on either side).
 *
 * Historical note: before v4.4.3 this function only read env vars. Because
 * the admin console writes to the DB, sign-ins would always use the
 * zero GUID and fail with `AADSTS700038`. The async variant below is
 * the supported entry point; the sync variant is kept for any callers
 * that still use it and serves from the resolved cache.
 */

const ZERO_GUID = "00000000-0000-0000-0000-000000000000";

interface PublicSsoConfig {
  enabled: boolean;
  tenantId: string | null;
  clientId: string | null;
  authority: string | null;
  allowedEmailDomains: string[];
}

export interface ResolvedSsoConfig {
  clientId: string;
  tenantId: string;
  /** Fully-qualified authority if the server supplied one, else null. */
  authority: string | null;
  /** True when a usable (non-placeholder) clientId was resolved. */
  configured: boolean;
}

let cached: ResolvedSsoConfig | null = null;

function envDefaults(): { clientId: string; tenantId: string } {
  const clientId =
    (import.meta.env.VITE_AZURE_CLIENT_ID as string | undefined)?.trim() || ZERO_GUID;
  const tenantId =
    (import.meta.env.VITE_AZURE_TENANT_ID as string | undefined)?.trim() || "common";
  return { clientId, tenantId };
}

async function fetchPublicSso(): Promise<PublicSsoConfig | null> {
  try {
    const res = await fetch("/api/auth/config", { credentials: "same-origin" });
    if (!res.ok) return null;
    const json = (await res.json()) as { sso?: PublicSsoConfig };
    return json.sso ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve the effective SSO config (DB → env → placeholder) and cache it.
 * Safe to call multiple times; the cache is populated on the first call.
 */
export async function resolveRuntimeSsoConfig(): Promise<ResolvedSsoConfig> {
  if (cached) return cached;
  const env = envDefaults();
  let clientId = env.clientId;
  let tenantId = env.tenantId;
  let authority: string | null = null;

  if (!isMockAuthMode()) {
    const sso = await fetchPublicSso();
    if (sso) {
      if (sso.clientId && sso.clientId.trim()) clientId = sso.clientId.trim();
      if (sso.tenantId && sso.tenantId.trim()) tenantId = sso.tenantId.trim();
      if (sso.authority && sso.authority.trim()) authority = sso.authority.trim();
    }
  }

  cached = {
    clientId,
    tenantId,
    authority,
    configured: clientId !== ZERO_GUID && clientId.length > 0,
  };
  return cached;
}

/** Returns the cached resolved config, or null if {@link resolveRuntimeSsoConfig} hasn't run yet. */
export function getResolvedSsoConfig(): ResolvedSsoConfig | null {
  return cached;
}

/** Reset the cache — useful after an admin saves new SSO settings. */
export function resetRuntimeSsoCache(): void {
  cached = null;
}

function buildConfiguration(resolved: ResolvedSsoConfig): Configuration {
  const explicitRedirect = import.meta.env.VITE_AZURE_REDIRECT_URI as string | undefined;
  const redirectUri =
    typeof explicitRedirect === "string" && explicitRedirect.trim()
      ? explicitRedirect.trim()
      : `${window.location.origin}/auth/callback`;
  const postLogout = `${window.location.origin}/`;
  const authority =
    resolved.authority ?? `https://login.microsoftonline.com/${resolved.tenantId}`;

  return {
    auth: {
      clientId: resolved.clientId,
      authority,
      redirectUri,
      postLogoutRedirectUri: postLogout,
    },
    cache: {
      cacheLocation: "sessionStorage",
    },
  };
}

/**
 * Build MSAL configuration using the effective (DB-merged) SSO settings.
 * This is the preferred entry point for both the main and admin bootstraps.
 */
export async function getMsalConfigurationAsync(): Promise<Configuration> {
  const resolved = await resolveRuntimeSsoConfig();
  return buildConfiguration(resolved);
}

/**
 * Legacy sync entry point. Prefers the resolved cache when available;
 * otherwise falls back to env defaults. Kept for compatibility with any
 * older callers that haven't migrated to the async variant.
 */
export function getMsalConfiguration(): Configuration {
  if (cached) return buildConfiguration(cached);
  const env = envDefaults();
  return buildConfiguration({
    clientId: env.clientId,
    tenantId: env.tenantId,
    authority: null,
    configured: env.clientId !== ZERO_GUID,
  });
}

/** Scopes for sign-in and ID token (add API scope when calling a protected API). */
export const loginRequest = {
  scopes: ["openid", "profile", "email"],
};

/**
 * Delegated scope for this app's API (Entra: Expose an API → `access_as_user`).
 * Prefers the resolved cache, then `VITE_API_SCOPE`, then a derived
 * `api://{clientId}/access_as_user`.
 */
export function apiAccessScopes(): string[] {
  if (isMockAuthMode()) return [];
  const custom = import.meta.env.VITE_API_SCOPE as string | undefined;
  if (typeof custom === "string" && custom.trim()) return [custom.trim()];
  const clientId = cached?.clientId ?? (import.meta.env.VITE_AZURE_CLIENT_ID as string | undefined);
  if (!clientId || clientId === ZERO_GUID) return [];
  return [`api://${clientId}/access_as_user`];
}
