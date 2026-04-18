import { useState } from "react";
import { changeLocalPassword, getLocalSession, logoutLocal } from "../auth/localSession";
import { APP_VERSION } from "../appVersion";

/** Shown after local sign-in when the server flagged the account with must_change_password. */
export function AdminChangePassword({ onDone }: { onDone: () => void }) {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const session = getLocalSession();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError("New password and confirmation do not match.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      await changeLocalPassword(currentPassword, newPassword);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <h1>Admin Console</h1>
      </header>
      <main className="admin-main">
        <section className="admin-card" style={{ maxWidth: 560 }}>
          <h2>Choose a new password</h2>
          <p>
            Signed in as <strong>{session?.user.email ?? "local account"}</strong>. You must
            update your password before continuing.
          </p>
          {error ? (
            <p className="error-banner" role="alert">
              {error}
            </p>
          ) : null}
          <form onSubmit={submit} className="admin-login-form">
            <label className="field">
              <span>Current password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrent(e.target.value)}
                required
                disabled={pending}
              />
            </label>
            <label className="field">
              <span>New password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNext(e.target.value)}
                required
                disabled={pending}
              />
            </label>
            <label className="field">
              <span>Confirm new password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                disabled={pending}
              />
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="submit" className="btn btn-primary" disabled={pending}>
                {pending ? "Updating…" : "Update password"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  logoutLocal();
                  window.location.reload();
                }}
                disabled={pending}
              >
                Sign out
              </button>
            </div>
            <p className="muted" style={{ marginTop: "0.75rem" }}>
              Minimum 12 characters, at least 3 of: lowercase, uppercase, digit, symbol.
            </p>
          </form>
        </section>
      </main>
      <footer className="admin-footer">CABQ Comprehensive Plan Admin · v{APP_VERSION}</footer>
    </div>
  );
}
