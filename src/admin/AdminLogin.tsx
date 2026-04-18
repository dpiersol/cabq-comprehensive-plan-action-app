import { useEffect, useState } from "react";
import { loginMockAdmin, loginMockCityUser } from "../auth";
import { isMockAuthMode } from "../auth/entraEligibility";
import { loginLocal } from "../auth/localSession";
import { msalLoginRedirect } from "../msal/msalInstance";
import { APP_VERSION } from "../appVersion";
import { fetchPublicAuthConfig, type PublicAuthConfig } from "./authAdminApi";

type Tab = "local" | "sso";

export function AdminLogin({ error: outerError }: { error: string | null }) {
  const [cfg, setCfg] = useState<PublicAuthConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("local");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(outerError);

  useEffect(() => {
    fetchPublicAuthConfig()
      .then((c) => {
        setCfg(c);
        // Prefer SSO tab if it's available and local isn't.
        if (c.sso.enabled && !c.local.enabled) setTab("sso");
        if (!c.sso.enabled && c.local.enabled) setTab("local");
      })
      .catch(() => setCfg({ sso: { enabled: false, tenantId: null, clientId: null, authority: null, allowedEmailDomains: [] }, local: { enabled: true } }))
      .finally(() => setLoading(false));
  }, []);

  async function handleLocal(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await loginLocal(identifier.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setPending(false);
    }
  }

  const ssoAvailable = Boolean(cfg?.sso.enabled);
  const localAvailable = Boolean(cfg?.local.enabled) || isMockAuthMode();

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <h1>Admin Console</h1>
      </header>
      <main className="admin-main">
        <section className="admin-card" style={{ maxWidth: 560 }}>
          <h2>Sign in</h2>
          {loading ? <p className="muted">Loading sign-in options…</p> : null}

          {!loading && (localAvailable || ssoAvailable) ? (
            <div className="admin-login-tabs" role="tablist" aria-label="Sign-in methods">
              {localAvailable ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "local"}
                  className={`tab-btn ${tab === "local" ? "is-active" : ""}`}
                  onClick={() => setTab("local")}
                >
                  Local account
                </button>
              ) : null}
              {ssoAvailable ? (
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "sso"}
                  className={`tab-btn ${tab === "sso" ? "is-active" : ""}`}
                  onClick={() => setTab("sso")}
                >
                  Microsoft (SSO)
                </button>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="error-banner" role="alert" style={{ marginTop: "0.75rem" }}>
              {error}
            </p>
          ) : null}

          {!loading && tab === "local" && localAvailable ? (
            <form onSubmit={handleLocal} className="admin-login-form">
              <label className="field">
                <span>Username or email</span>
                <input
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  disabled={pending}
                />
              </label>
              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={pending}
                />
              </label>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={pending || !identifier.trim() || !password}
              >
                {pending ? "Signing in…" : "Sign in"}
              </button>
              {isMockAuthMode() ? (
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    marginTop: "0.75rem",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => loginMockAdmin()}
                  >
                    Dev Admin Login
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => loginMockCityUser()}
                  >
                    Dev User Login
                  </button>
                </div>
              ) : null}
            </form>
          ) : null}

          {!loading && tab === "sso" && ssoAvailable ? (
            <div style={{ marginTop: "0.75rem" }}>
              <p>Sign in with your City of Albuquerque Microsoft 365 account.</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setError(null);
                  msalLoginRedirect().catch((e: unknown) => {
                    setError(e instanceof Error ? e.message : "Sign-in failed");
                  });
                }}
              >
                Sign in with Microsoft
              </button>
            </div>
          ) : null}

          {!loading && !localAvailable && !ssoAvailable ? (
            <p className="error-banner" role="alert">
              No sign-in method is currently configured. Please contact an administrator.
            </p>
          ) : null}

          <p className="muted" style={{ marginTop: "1rem" }}>
            <a href="/">← Back to main app</a>
          </p>
        </section>
      </main>
      <footer className="admin-footer">CABQ Comprehensive Plan Admin · v{APP_VERSION}</footer>
    </div>
  );
}
