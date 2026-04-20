import { useCallback, useEffect, useState } from "react";
import {
  fetchAdminAuthConfig,
  patchAdminAuthConfig,
  testSsoToken,
  type AdminAuthConfig,
} from "./authAdminApi";

function toCsv(xs: string[]): string {
  return xs.join(", ");
}
function fromCsv(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function AuthSettingsPage() {
  const [cfg, setCfg] = useState<AdminAuthConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const [form, setForm] = useState({
    ssoEnabled: false,
    localEnabled: true,
    tenantId: "",
    clientId: "",
    audience: "",
    issuer: "",
    allowedEmailDomains: "",
    adminRoleNames: "",
    adminEmails: "",
  });

  const [testToken, setTestToken] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const c = await fetchAdminAuthConfig();
      setCfg(c);
      setForm({
        ssoEnabled: c.sso.enabled,
        localEnabled: c.local.enabled,
        tenantId: c.sso.tenantId ?? "",
        clientId: c.sso.clientId ?? "",
        audience: c.sso.audience ?? "",
        issuer: c.sso.issuer ?? "",
        allowedEmailDomains: toCsv(c.sso.allowedEmailDomains),
        adminRoleNames: toCsv(c.sso.adminRoleNames),
        adminEmails: toCsv(c.sso.adminEmails),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load config.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaveNotice(null);
    try {
      const updated = await patchAdminAuthConfig({
        ssoEnabled: form.ssoEnabled,
        localEnabled: form.localEnabled,
        tenantId: form.tenantId.trim() || null,
        clientId: form.clientId.trim() || null,
        audience: form.audience.trim() || null,
        issuer: form.issuer.trim() || null,
        allowedEmailDomains: fromCsv(form.allowedEmailDomains),
        adminRoleNames: fromCsv(form.adminRoleNames),
        adminEmails: fromCsv(form.adminEmails),
      });
      setCfg(updated);
      setSaveNotice(
        "Saved. Refresh your browser (Ctrl+F5) so the SPA re-reads the SSO config before signing in.",
      );
      window.setTimeout(() => setSaveNotice(null), 8000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    }
  }

  async function runTest() {
    setTestResult(null);
    try {
      const res = await testSsoToken({ token: testToken.trim() });
      if (res.ok) {
        setTestResult(`OK — claims: ${JSON.stringify(res.payload, null, 2)}`);
      } else {
        setTestResult(`Failed: ${res.error ?? "verification failed"}`);
      }
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : "Test failed.");
    }
  }

  if (loading) {
    return (
      <section className="admin-card">
        <p className="muted">Loading auth settings…</p>
      </section>
    );
  }

  return (
    <section className="admin-card">
      <h2 style={{ marginTop: 0 }}>Sign-in settings</h2>
      {error ? (
        <p className="error-banner" role="alert">
          {error}
        </p>
      ) : null}
      {saveNotice ? (
        <p style={{ color: "#047857", marginBottom: "0.5rem" }}>{saveNotice}</p>
      ) : null}
      {cfg && !cfg.local.configured ? (
        <p className="error-banner" role="alert">
          Server has no <code>LOCAL_JWT_SECRET</code> configured — local sign-in is disabled
          at the process level regardless of the toggle below.
        </p>
      ) : null}

      <form onSubmit={save} className="admin-inline-form">
        <fieldset>
          <legend>Methods</legend>
          <label style={{ display: "block", marginBottom: "0.25rem" }}>
            <input
              type="checkbox"
              checked={form.ssoEnabled}
              onChange={(e) => setForm((f) => ({ ...f, ssoEnabled: e.target.checked }))}
            />{" "}
            Microsoft SSO (Entra)
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.localEnabled}
              onChange={(e) => setForm((f) => ({ ...f, localEnabled: e.target.checked }))}
            />{" "}
            Local accounts
          </label>
        </fieldset>

        <fieldset style={{ marginTop: "0.75rem" }}>
          <legend>Microsoft SSO</legend>
          <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "1fr 1fr" }}>
            <label className="field">
              <span>Tenant ID</span>
              <input
                value={form.tenantId}
                onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}
                placeholder="GUID"
              />
            </label>
            <label className="field">
              <span>Client (application) ID</span>
              <input
                value={form.clientId}
                onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                placeholder="GUID"
              />
            </label>
            <label className="field">
              <span>API audience (Application ID URI)</span>
              <input
                value={form.audience}
                onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
                placeholder="api://<app-id>  (NOT a redirect URI)"
              />
              <small className="muted">
                Used to validate access tokens on the API. Typically{" "}
                <code>api://&lt;Client ID&gt;</code> or the Client ID itself. Leave blank to
                accept tokens whose audience equals the Client ID. This is <strong>not</strong>{" "}
                the redirect URI — that is configured in Entra under the app registration's
                Authentication blade (usually{" "}
                <code>{window.location.origin}/auth/callback</code>).
              </small>
            </label>
            <label className="field">
              <span>Issuer override (optional)</span>
              <input
                value={form.issuer}
                onChange={(e) => setForm((f) => ({ ...f, issuer: e.target.value }))}
                placeholder="https://login.microsoftonline.com/{tenant}/v2.0"
              />
            </label>
          </div>
          <label className="field">
            <span>Allowed email domains (comma separated)</span>
            <input
              value={form.allowedEmailDomains}
              onChange={(e) =>
                setForm((f) => ({ ...f, allowedEmailDomains: e.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>Admin role names (comma separated)</span>
            <input
              value={form.adminRoleNames}
              onChange={(e) => setForm((f) => ({ ...f, adminRoleNames: e.target.value }))}
            />
          </label>
          <label className="field">
            <span>Admin emails (comma separated)</span>
            <input
              value={form.adminEmails}
              onChange={(e) => setForm((f) => ({ ...f, adminEmails: e.target.value }))}
            />
          </label>
        </fieldset>

        <button type="submit" className="btn btn-primary" style={{ marginTop: "0.75rem" }}>
          Save settings
        </button>
      </form>

      <hr style={{ margin: "1.25rem 0" }} />

      <h3>Test SSO token</h3>
      <p className="muted">
        Paste an Entra access token to verify it against the current (saved) tenant + audience +
        issuer. Handy for checking a new app registration before rolling it out.
      </p>
      <textarea
        value={testToken}
        onChange={(e) => setTestToken(e.target.value)}
        rows={4}
        style={{ width: "100%" }}
        placeholder="eyJ…"
      />
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={runTest}
          disabled={!testToken.trim()}
        >
          Verify token
        </button>
      </div>
      {testResult ? (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "#f7f7f7",
            padding: "0.5rem",
            marginTop: "0.5rem",
          }}
        >
          {testResult}
        </pre>
      ) : null}
    </section>
  );
}
