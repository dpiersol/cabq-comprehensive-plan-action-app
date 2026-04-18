import type { PublicClientApplication } from "@azure/msal-browser";
import { apiAccessScopes } from "./msalConfig";

let instance: PublicClientApplication | null = null;

/** Called once from `main.tsx` after MSAL initializes. */
export function registerMsalInstance(pca: PublicClientApplication): void {
  instance = pca;
}

/**
 * Access token for `/api/submissions` when Entra exposes an API scope.
 * Returns `undefined` if MSAL is not ready, scopes are not configured, or silent acquisition fails.
 */
export async function acquireApiAccessToken(): Promise<string | undefined> {
  const pca = instance;
  if (!pca) return undefined;
  const scopes = apiAccessScopes();
  if (scopes.length === 0) return undefined;
  const accounts = pca.getAllAccounts();
  if (accounts.length === 0) return undefined;
  try {
    const result = await pca.acquireTokenSilent({
      account: accounts[0],
      scopes,
    });
    return result.accessToken;
  } catch {
    return undefined;
  }
}
