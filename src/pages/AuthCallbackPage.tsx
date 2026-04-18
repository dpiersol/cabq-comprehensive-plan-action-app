import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * OAuth redirect URI — MSAL completes in {@link ../main.tsx} before render; we route users into the app.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/app", { replace: true });
  }, [navigate]);

  return (
    <div className="app-shell">
      <main className="site-main">
        <p className="loading">Completing sign-in…</p>
      </main>
    </div>
  );
}
