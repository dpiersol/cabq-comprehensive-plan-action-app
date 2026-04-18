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
          Sign in with your City of Albuquerque network account (@cabq.gov). Access is restricted to authorized
          users only.
        </p>
      </header>

      <main className="site-main landing-main">
        <section className="card landing-card">
          <h2>Sign in</h2>
          {isMockAuthMode() ? (
            <>
              <p className="hint">
                <strong>Development mode:</strong> Azure client ID is not configured (or{" "}
                <code>VITE_AUTH_MODE=mock</code>). Use a mock account below. Configure{" "}
                <code>VITE_AZURE_CLIENT_ID</code> and <code>VITE_AZURE_TENANT_ID</code> for Entra ID.
              </p>
              <div className="btn-row">
                <button type="button" className="btn btn-primary" onClick={() => {
                  loginMockCityUser();
                  navigate("/app");
                }}>
                  Mock city user
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => {
                  loginMockAdmin();
                  navigate("/app");
                }}>
                  Mock admin
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
        CABQ Comprehensive Plan Action Application · v{APP_VERSION}
      </footer>
    </div>
  );
}
