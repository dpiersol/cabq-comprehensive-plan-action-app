import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { APP_VERSION } from "../appVersion";
import { loginMockAdmin, loginMockCityUser } from "../auth";
import {
  getEmailFromClaims,
  isAllowedEmailDomain,
  isMockAuthMode,
} from "../auth/entraEligibility";
import { loginRequest } from "../msal/msalConfig";

/** Public landing — sign in with Entra ID (single-tenant City) or dev mock buttons. */
export function LandingPage() {
  const { instance } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const navigate = useNavigate();

  useEffect(() => {
    if (isMockAuthMode()) return;
    if (!isAuthenticated) return;
    const accounts = instance.getAllAccounts();
    const account = accounts[0];
    if (!account) return;
    const claims = account.idTokenClaims as Record<string, unknown> | undefined;
    const email = getEmailFromClaims(claims ?? {});
    if (email && isAllowedEmailDomain(email)) navigate("/app", { replace: true });
  }, [instance, isAuthenticated, navigate]);

  function handleEntraLogin() {
    instance.loginRedirect({
      ...loginRequest,
      prompt: "select_account",
    });
  }

  return (
    <div className="app-shell landing-page">
      <header className="site-header no-print">
        <h1>CABQ Comprehensive Plan — Action documentation</h1>
        <p className="site-header-lede">
          <strong>Testing build.</strong> Entra sign-in is bypassed for stakeholder review. Pick a role below
          to enter the application.
        </p>
      </header>

      <main className="site-main landing-main">
        <section className="card landing-card">
          <h2>Sign in (Testing)</h2>
          {isMockAuthMode() ? (
            <>
              <p className="hint">
                No Microsoft password needed on this branch. <strong>Dev User</strong> loads the app as a
                standard City user; <strong>Dev Admin</strong> loads it with admin role so the Admin Console
                link appears.
              </p>
              <div className="btn-row">
                <button type="button" className="btn btn-primary" onClick={() => {
                  loginMockCityUser();
                  navigate("/app");
                }}>
                  Dev User Login
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => {
                  loginMockAdmin();
                  navigate("/app");
                }}>
                  Dev Admin Login
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="hint">You will be redirected to Microsoft to sign in with your cabq.gov account.</p>
              <div className="btn-row">
                <button type="button" className="btn btn-primary" onClick={handleEntraLogin}>
                  Sign in with Microsoft
                </button>
              </div>
            </>
          )}
        </section>
      </main>

      <footer className="site-footer no-print">
        CABQ Comprehensive Plan Action Application · v{APP_VERSION} · Testing
      </footer>
    </div>
  );
}
