import { useCallback, useEffect, useState } from "react";
import {
  createRole,
  deleteRole,
  listRoles,
  type RoleDto,
} from "./authAdminApi";

export function RolesPage() {
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [adminCount, setAdminCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const r = await listRoles();
      setRoles(r.roles);
      setAdminCount(r.adminCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load roles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createRole(newName.trim(), newDesc.trim() || null);
      setNewName("");
      setNewDesc("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
    }
  }

  async function remove(name: string) {
    if (!window.confirm(`Delete role "${name}"?`)) return;
    setError(null);
    try {
      await deleteRole(name);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  return (
    <section className="admin-card">
      <h2 style={{ marginTop: 0 }}>Roles</h2>
      <p className="muted">
        Active admin users holding <code>comp-plan-admin</code>: <strong>{adminCount}</strong>.
      </p>
      {error ? (
        <p className="error-banner" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="muted">Loading roles…</p> : null}

      <table className="admin-users-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Members</th>
            <th>Built-in</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.name}>
              <td>
                <code>{r.name}</code>
              </td>
              <td>{r.description ?? <span className="muted">—</span>}</td>
              <td>{r.memberCount}</td>
              <td>{r.isBuiltin ? "Yes" : "No"}</td>
              <td>
                {r.isBuiltin ? (
                  <span className="muted">(protected)</span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => remove(r.name)}
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form onSubmit={add} className="admin-inline-form" style={{ marginTop: "1rem" }}>
        <h3>Add a custom role</h3>
        <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "1fr 2fr" }}>
          <label className="field">
            <span>Name</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. comp-plan-reviewer"
              required
            />
          </label>
          <label className="field">
            <span>Description</span>
            <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          </label>
        </div>
        <button type="submit" className="btn btn-primary" style={{ marginTop: "0.5rem" }}>
          Add role
        </button>
      </form>
    </section>
  );
}
