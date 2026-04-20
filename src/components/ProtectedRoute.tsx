import { useMsal } from "@azure/msal-react";
import { Navigate } from "react-router-dom";
import { useSyncExternalStore } from "react";
import { getAuthUser, subscribeAuth } from "../auth";
import {
  getEmailFromClaims,
  isAllowedEmailDomain,
  isMockAuthMode,
} from "../auth/entraEligibility";

interface Props {
  children: React.ReactNode;
}

/**
 * Allows access when:
 * - Mock mode: {@link AuthUser} is set via dev buttons; or
 * - Entra mode: MSAL has an active account whose ID token resolves to an allowed `@cabq.gov` email domain.
 */
export function ProtectedRoute({ children }: Props) {
  const { accounts } = useMsal();
  const mockUser = useSyncExternalStore(subscribeAuth, getAuthUser, () => null);

  if (isMockAuthMode()) {
    if (!mockUser) return <Navigate to="/" replace />;
    if (!isAllowedEmailDomain(mockUser.email)) return <Navigate to="/access-denied" replace />;
    return <>{children}</>;
  }

  const account = accounts[0];
  if (!account) return <Navigate to="/" replace />;

  const claims = account.idTokenClaims as Record<string, unknown> | undefined;
  const email = getEmailFromClaims(claims ?? {});
  if (!email || !isAllowedEmailDomain(email)) {
    return <Navigate to="/access-denied" replace />;
  }

  return <>{children}</>;
}
