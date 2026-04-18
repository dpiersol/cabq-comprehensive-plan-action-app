import { useMsal } from "@azure/msal-react";
import { useNavigate } from "react-router-dom";
import { setAuthUser } from "../auth";
import { isMockAuthMode } from "../auth/entraEligibility";

/** Signs out of Entra ID (or clears mock session) and returns to the landing page. */
export function SignOutButton() {
  const { instance } = useMsal();
  const navigate = useNavigate();

  function handleClick() {
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
