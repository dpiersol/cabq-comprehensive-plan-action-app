import { useEffect, useState } from "react";
import { getAuthUser, isAdmin, subscribeAuth } from "../auth";
import { getLocalSession, logoutLocal } from "../auth/localSession";
import { APP_VERSION } from "../appVersion";
import { AdminLogin } from "./AdminLogin";
import { AdminChangePassword } from "./AdminChangePassword";

/**
 * Gates the admin console behind sign-in + admin role. Supports both local
 * (username/password → JWT) and Microsoft SSO sign-in, driven by the public
 * `/api/auth/config` endpoint.
 */
export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState(getAuthUser);
  const [mustChange, setMustChange] = useState(
    () => getLocalSession()?.user.mustChangePassword ?? false,
  );

  useEffect(
    () =>
      subscribeAuth(() => {
        setUser(getAuthUser());
        setMustChange(getLocalSession()?.user.mustChangePassword ?? false);
      }),
    [],
  );

  if (!user) {
    return <AdminLogin error={null} />;
  }

  if (mustChange) {
    return <AdminChangePassword onDone={() => setMustChange(false)} />;
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
              Signed in as <strong>{user.email}</strong>. This account does not hold the admin
              role (<code>comp-plan-admin</code>) required for the admin console.
            </p>
            <p>Please contact an administrator to request access.</p>
            <p style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  logoutLocal();
                  window.location.reload();
                }}
              >
                Sign out
              </button>
              <a href="/" className="btn btn-secondary">
                ← Back to main app
              </a>
            </p>
          </section>
        </main>
        <footer className="admin-footer">CABQ Comprehensive Plan Admin · v{APP_VERSION}</footer>
      </div>
    );
  }

  return <>{children}</>;
}
