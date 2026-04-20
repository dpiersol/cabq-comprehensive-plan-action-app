import { useMsal } from "@azure/msal-react";
import { useEffect } from "react";
import {
  getEmailFromClaims,
  isMockAuthMode,
  rolesFromIdTokenClaims,
} from "../auth/entraEligibility";
import { getLocalSession } from "../auth/localSession";
import { setAuthUser } from "../auth";

/** Syncs active MSAL account + ID token claims into {@link ./auth.ts} for `useAuth` consumers. */
export function EntraAuthSync({ children }: { children: React.ReactNode }) {
  const { accounts } = useMsal();

  useEffect(() => {
    if (isMockAuthMode()) return;

    // A local session (normal local sign-in OR /devlogin) owns the auth
    // state. Don't clobber it just because MSAL has no account.
    if (getLocalSession()) return;

    const account = accounts[0];
    if (!account) {
      setAuthUser(null);
      return;
    }

    const claims = account.idTokenClaims as Record<string, unknown> | undefined;
    const email = getEmailFromClaims(claims ?? {});
    if (!email) {
      setAuthUser(null);
      return;
    }
    const roles = rolesFromIdTokenClaims(claims ?? {});
    const displayName =
      (typeof claims?.["name"] === "string" ? claims["name"] : null) ||
      account.name ||
      email ||
      "Signed-in user";
    const oid =
      (typeof claims?.["oid"] === "string" ? claims["oid"] : undefined) || account.localAccountId;
    const tenantId = typeof claims?.["tid"] === "string" ? claims["tid"] : undefined;

    setAuthUser({
      displayName,
      email,
      roles,
      oid,
      tenantId,
    });
  }, [accounts]);

  return <>{children}</>;
}
