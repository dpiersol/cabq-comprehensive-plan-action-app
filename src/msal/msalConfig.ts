import type { Configuration } from "@azure/msal-browser";
import { isMockAuthMode } from "../auth/entraEligibility";

/**
 * MSAL configuration for Azure Entra ID (single-tenant SPA).
 * Set VITE_AZURE_CLIENT_ID, VITE_AZURE_TENANT_ID, and optional VITE_AZURE_REDIRECT_URI in `.env`.
 */
export function getMsalConfiguration(): Configuration {
  const clientId = import.meta.env.VITE_AZURE_CLIENT_ID ?? "00000000-0000-0000-0000-000000000000";
  const tenantId = import.meta.env.VITE_AZURE_TENANT_ID ?? "common";
  const explicitRedirect = import.meta.env.VITE_AZURE_REDIRECT_URI;
  const redirectUri =
    typeof explicitRedirect === "string" && explicitRedirect.trim()
      ? explicitRedirect.trim()
      : `${window.location.origin}/auth/callback`;
  const postLogout = `${window.location.origin}/`;

  return {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      redirectUri,
      postLogoutRedirectUri: postLogout,
    },
    cache: {
      cacheLocation: "sessionStorage",
    },
  };
}

/** Scopes for sign-in and ID token (add API scope when calling a protected API). */
export const loginRequest = {
  scopes: ["openid", "profile", "email"],
};

/**
 * Delegated scope for this app's API (Entra: Expose an API → `access_as_user`).
 * Override with **`VITE_API_SCOPE`** if your Application ID URI differs.
 */
export function apiAccessScopes(): string[] {
  if (isMockAuthMode()) return [];
  const custom = import.meta.env.VITE_API_SCOPE;
  if (typeof custom === "string" && custom.trim()) return [custom.trim()];
  const clientId = import.meta.env.VITE_AZURE_CLIENT_ID;
  if (!clientId || clientId === "00000000-0000-0000-0000-000000000000") return [];
  return [`api://${clientId}/access_as_user`];
}
