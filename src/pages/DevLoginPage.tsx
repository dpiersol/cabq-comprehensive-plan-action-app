import { useEffect, useState } from "react";
import { APP_VERSION } from "../appVersion";
import {
  fetchDevLoginStatus,
  isDevLoginBuild,
  loginDev,
  type DevRole,
} from "../auth/devLogin";

/**
 * Sandbox-only page that issues a dev session (user or admin) with no
 * password. Renders a safety-stub page unless BOTH the build flag
 * (`VITE_DEV_LOGIN_ENABLED=true`) and the server flag (ENABLE_DEV_LOGIN=true,
 * exposed through /api/auth/dev-login/status) are true.
 */
export function DevLoginPage() {
  // When the build flag is off there is nothing to check with the server —
  // start with `false` directly so the stub renders on the first paint.
  const [serverEnabled, setServerEnabled] = useState<boolean | null>(() =>
    isDevLoginBuild() ? null : false,
  );
  const [busy, setBusy] = useState<DevRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isDevLoginBuild()) return;
    fetchDevLoginStatus().then((s) => setServerEnabled(s.enabled));
  }, []);

  async function handle(role: DevRole) {
    setBusy(role);
    setError(null);
    try {
      await loginDev(role);
      // Full page reload so both the main SPA and the admin SPA reinitialize
      // `localSession.ts` from storage and pick up the new JWT. Admin is a
      // separate Vite entry bundle served at `/admin.html` (not `/admin/`).
      window.location.assign(role === "admin" ? "/admin.html" : "/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dev login failed.");
      setBusy(null);
    }
  }

  const gateOpen = isDevLoginBuild() && serverEnabled === true;

  return (
    <div className="app-shell landing-page">
      <header className="site-header no-print">
        <h1>Dev Login</h1>
        <p className="site-header-lede">
          Sandbox-only shortcut. Not available in production builds.
        </p>
      </header>

      <main className="site-main landing-main">
        <section className="card landing-card" style={{ maxWidth: 640 }}>
          {!isDevLoginBuild() && (
            <>
              <h2>Not available</h2>
              <p className="hint">
                This build of the application was produced without the dev-login
                flag (<code>VITE_DEV_LOGIN_ENABLED</code>). Rebuild with{" "}
                <code>npm run build:sandbox</code> to enable it.
              </p>
              <p>
                <a href="/" className="btn btn-secondary">← Back to landing</a>
              </p>
            </>
          )}

          {isDevLoginBuild() && serverEnabled === null && (
            <>
              <h2>Checking…</h2>
              <p className="hint">Verifying dev-login availability on the server.</p>
            </>
          )}

          {isDevLoginBuild() && serverEnabled === false && (
            <>
              <h2>Disabled on this server</h2>
              <p className="hint">
                The server does not have <code>ENABLE_DEV_LOGIN=true</code>. Set it in
                the server <code>.env</code> and restart the API (sandbox only — never
                in production).
              </p>
              <p>
                <a href="/" className="btn btn-secondary">← Back to landing</a>
              </p>
            </>
          )}

          {gateOpen && (
            <>
              <h2>Sign in without a password</h2>
              <p className="hint">
                These buttons issue a short-lived local session token so you can
                explore the app. Every use is recorded in the admin audit log.
              </p>

              {error && (
                <p
                  role="alert"
                  className="hint"
                  style={{ color: "var(--color-error, #b00020)" }}
                >
                  {error}
                </p>
              )}

              <div className="btn-row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy !== null}
                  onClick={() => handle("user")}
                >
                  {busy === "user" ? "Signing in…" : "Dev User Login"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy !== null}
                  onClick={() => handle("admin")}
                >
                  {busy === "admin" ? "Signing in…" : "Dev Admin Login"}
                </button>
                <a href="/" className="btn btn-secondary">
                  ← Back to landing
                </a>
              </div>

              <p
                className="hint"
                style={{ marginTop: "1rem", fontSize: "0.875rem", opacity: 0.8 }}
              >
                <strong>Sandbox only.</strong> This page is excluded from production
                builds and the server route is not registered when{" "}
                <code>ENABLE_DEV_LOGIN</code> is unset.
              </p>
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
