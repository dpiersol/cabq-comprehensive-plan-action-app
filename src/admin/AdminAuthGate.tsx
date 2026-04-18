import { useEffect, useState } from "react";
import { getAuthUser, isAdmin, subscribeAuth, loginMockAdmin, loginMockCityUser } from "../auth";
import { isMockAuthMode } from "../auth/entraEligibility";
import { msalLoginRedirect } from "../msal/msalInstance";
import { APP_VERSION } from "../appVersion";

/**
 * Gates the admin console behind sign-in + admin role. Mirrors the main app's auth flow:
 * unauthenticated users see a sign-in screen; non-admins see a "not authorized" screen.
 */
export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState(getAuthUser);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeAuth(() => setUser(getAuthUser())), []);

  if (!user) {
    return (
      <div className="admin-shell">
        <header className="admin-header">
          <h1>Admin Console</h1>
        </header>
        <main className="admin-main">
          <section className="admin-card" style={{ maxWidth: 560 }}>
            <h2>Sign in required</h2>
            <p>
              The admin console lists all submitted Comprehensive Plan records across the City. You
              must sign in with an account that has the admin role.
            </p>
            {error && (
              <p className="error-banner" role="alert" style={{ marginTop: "0.5rem" }}>{error}</p>
            )}
            {isMockAuthMode() ? (
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button type="button" className="btn btn-primary" onClick={() => loginMockAdmin()}>
                  Dev Admin Login
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => loginMockCityUser()}>
                  Dev User Login
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  msalLoginRedirect().catch((e: unknown) => {
                    setError(e instanceof Error ? e.message : "Sign-in failed");
                  });
                }}
              >
                Sign in with Microsoft
              </button>
            )}
            <p className="muted" style={{ marginTop: "1rem" }}>
              <a href="/">← Back to main app</a>
            </p>
          </section>
        </main>
        <footer className="admin-footer">CABQ Comprehensive Plan Admin · v{APP_VERSION}</footer>
      </div>
    );
  }

  if (!isAdmin()) {
    return (
      <div className="admin-shell">
        <header className="admin-header">
          <h1>Admin Console</h1>
        </header>
        <main className="admin-main">
          <section className="admin-card" style={{ maxWidth: 560 }}>
            <h2>Not authorized</h2>
            <p>
              Signed in as <strong>{user.email}</strong>. This account does not have the admin role
              (<code>comp-plan-admin</code>) required for the admin console.
            </p>
            <p>Please contact an administrator to request access.</p>
            <p className="muted">
              <a href="/">← Back to main app</a>
            </p>
          </section>
        </main>
        <footer className="admin-footer">CABQ Comprehensive Plan Admin · v{APP_VERSION}</footer>
      </div>
    );
  }

  return <>{children}</>;
}
