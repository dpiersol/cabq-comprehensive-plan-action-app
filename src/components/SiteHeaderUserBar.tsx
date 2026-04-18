import { SignOutButton } from "./SignOutButton";
import { useAuth } from "../useAuth";

/**
 * Compact "Logged in as: {name}" + Sign out (+ Admin Console for admins) strip,
 * rendered in the top-right of the site header on authenticated pages.
 *
 * The display name is taken from the Entra ID token (`name` claim, via MSAL)
 * or from the mock session in `loginMock*`. Falls back to `"Test User"` when
 * there is no authenticated user — matches the Testing branch requirement.
 */
export function SiteHeaderUserBar() {
  const { user, isAdmin } = useAuth();
  const displayName = user?.displayName?.trim() || "Test User";

  return (
    <div className="site-header-userbar no-print" aria-label="Account">
      <span className="site-header-userlabel">
        Logged in as: <strong>{displayName}</strong>
      </span>
      <SignOutButton />
      {isAdmin ? (
        <a href="/admin.html" className="admin-link site-header-adminlink">
          Admin Console
        </a>
      ) : null}
    </div>
  );
}
