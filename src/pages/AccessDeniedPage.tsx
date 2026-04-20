import { useMsal } from "@azure/msal-react";
import { Link, useNavigate } from "react-router-dom";
import { setAuthUser } from "../auth";
import { isMockAuthMode } from "../auth/entraEligibility";

/** Shown when the signed-in account is not allowed (e.g. not an @cabq.gov email). */
export function AccessDeniedPage() {
  const { instance } = useMsal();
  const navigate = useNavigate();

  async function handleSignOut() {
    setAuthUser(null);
    if (isMockAuthMode()) {
      navigate("/", { replace: true });
      return;
    }
    try {
      await instance.logoutRedirect({
        postLogoutRedirectUri: window.location.origin + "/",
      });
    } catch {
      window.location.href = "/";
    }
  }

  return (
    <div className="app-shell">
      <main className="site-main">
        <section className="card">
          <h2>Access not permitted</h2>
          <p>
            This application is limited to City of Albuquerque accounts (see allowed email domains in your
            organization&apos;s configuration). The account you used is not authorized.
          </p>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={() => void handleSignOut()}>
              Sign out and try another account
            </button>
            <Link to="/" className="btn btn-secondary">
              Back to home
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
