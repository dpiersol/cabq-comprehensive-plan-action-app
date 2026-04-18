import { useMsal } from "@azure/msal-react";
import { useNavigate } from "react-router-dom";
import { setAuthUser } from "../auth";
import { isMockAuthMode } from "../auth/entraEligibility";
import { getLocalSession, logoutLocal } from "../auth/localSession";

/** Signs out of Entra ID / local session (or clears mock) and returns to the landing page. */
export function SignOutButton() {
  const { instance } = useMsal();
  const navigate = useNavigate();

  function handleClick() {
    // If the caller is on a local session, just clear it locally.
    if (getLocalSession()) {
      logoutLocal();
      navigate("/", { replace: true });
      return;
    }
    setAuthUser(null);
    if (isMockAuthMode()) {
      navigate("/", { replace: true });
      return;
    }
    void instance.logoutRedirect({
      postLogoutRedirectUri: `${window.location.origin}/`,
    });
  }

  return (
    <button type="button" className="link-button sign-out-link" onClick={handleClick}>
      Sign out
    </button>
  );
}
