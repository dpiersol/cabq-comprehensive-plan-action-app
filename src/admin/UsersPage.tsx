import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createLocalUser,
  deleteLocalUser,
  listLocalUsers,
  listRoles,
  patchLocalUser,
  resetLocalUserPassword,
  type LocalUserDto,
  type RoleDto,
} from "./authAdminApi";

export function UsersPage() {
  const [users, setUsers] = useState<LocalUserDto[]>([]);
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [u, r] = await Promise.all([listLocalUsers(), listRoles()]);
      setUsers(u);
      setRoles(r.roles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  async function togglePasswordReset(id: string, password: string) {
    await resetLocalUserPassword(id, password);
    await refresh();
  }

  async function saveEdits(
    id: string,
    patch: Parameters<typeof patchLocalUser>[1],
  ) {
    await patchLocalUser(id, patch);
    await refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this local user? This cannot be undone.")) return;
    try {
      await deleteLocalUser(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  return (
    <section className="admin-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Local users</h2>
        <button type="button" className="btn btn-primary" onClick={() => setShowCreate((s) => !s)}>
          {showCreate ? "Close" : "Add user"}
        </button>
      </div>
      {error ? (
        <p className="error-banner" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="muted">Loading users…</p> : null}

      {showCreate ? (
        <CreateUserForm
          roles={roles}
          onCreated={async () => {
            setShowCreate(false);
            await refresh();
          }}
          onError={(m) => setError(m)}
        />
      ) : null}

      {!loading && users.length === 0 ? (
        <p className="muted">No local users yet.</p>
      ) : null}

      <table className="admin-users-table" style={{ marginTop: "0.75rem" }}>
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>Roles</th>
            <th>Status</th>
            <th>Last login</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <>
              <tr key={u.id}>
                <td>
                  <strong>{u.username}</strong>
                  <div className="muted" style={{ fontSize: "0.85em" }}>
                    {u.displayName}
                  </div>
                </td>
                <td>{u.email}</td>
                <td>{u.roles.join(", ") || <span className="muted">(none)</span>}</td>
                <td>
                  {u.isActive ? (
                    u.isLocked ? (
                      <span style={{ color: "#b45309" }}>Locked</span>
                    ) : u.mustChangePassword ? (
                      <span style={{ color: "#b45309" }}>Must change pw</span>
                    ) : (
                      <span style={{ color: "#047857" }}>Active</span>
                    )
                  ) : (
                    <span className="muted">Deactivated</span>
                  )}
                </td>
                <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setExpanded(expanded === u.id ? null : u.id)}
                  >
                    {expanded === u.id ? "Close" : "Manage"}
                  </button>
                </td>
              </tr>
              {expanded === u.id && byId.get(u.id) ? (
                <tr key={`${u.id}-detail`}>
                  <td colSpan={6}>
                    <UserEditPanel
                      user={byId.get(u.id)!}
                      roles={roles}
                      onSave={saveEdits}
                      onResetPassword={togglePasswordReset}
                      onDelete={remove}
                    />
                  </td>
                </tr>
              ) : null}
            </>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function CreateUserForm({
  roles,
  onCreated,
  onError,
}: {
  roles: RoleDto[];
  onCreated: () => Promise<void> | void;
  onError: (msg: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [selected, setSelected] = useState<string[]>(["comp-plan-user"]);
  const [mustChange, setMustChange] = useState(true);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await createLocalUser({
        username: username.trim(),
        email: email.trim(),
        displayName: displayName.trim(),
        password,
        roles: selected,
        mustChangePassword: mustChange,
      });
      await onCreated();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="admin-inline-form" style={{ marginTop: "0.75rem" }}>
      <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "1fr 1fr" }}>
        <label className="field">
          <span>Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} required />
        </label>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Initial password</span>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
      </div>
      <fieldset style={{ marginTop: "0.5rem" }}>
        <legend>Roles</legend>
        {roles.map((r) => (
          <label key={r.name} style={{ display: "inline-flex", gap: "0.25rem", marginRight: "0.75rem" }}>
            <input
              type="checkbox"
              checked={selected.includes(r.name)}
              onChange={(e) => {
                setSelected((prev) =>
                  e.target.checked ? [...prev, r.name] : prev.filter((n) => n !== r.name),
                );
              }}
            />
            {r.name}
          </label>
        ))}
      </fieldset>
      <label style={{ display: "inline-flex", gap: "0.25rem", marginTop: "0.5rem" }}>
        <input
          type="checkbox"
          checked={mustChange}
          onChange={(e) => setMustChange(e.target.checked)}
        />
        Force password change on first login
      </label>
      <div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Creating…" : "Create user"}
        </button>
      </div>
    </form>
  );
}

function UserEditPanel({
  user,
  roles,
  onSave,
  onResetPassword,
  onDelete,
}: {
  user: LocalUserDto;
  roles: RoleDto[];
  onSave: (
    id: string,
    patch: Parameters<typeof patchLocalUser>[1],
  ) => Promise<void>;
  onResetPassword: (id: string, password: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [email, setEmail] = useState(user.email);
  const [isActive, setIsActive] = useState(user.isActive);
  const [selected, setSelected] = useState<string[]>(user.roles);
  const [resetPw, setResetPw] = useState("");
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setLocalError(null);
    try {
      await onSave(user.id, { displayName, email, isActive, roles: selected });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setPending(false);
    }
  }

  async function doReset() {
    if (!resetPw) return;
    setPending(true);
    setLocalError(null);
    try {
      await onResetPassword(user.id, resetPw);
      setResetPw("");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="admin-inline-form" style={{ padding: "0.75rem", background: "#f7f7f7" }}>
      {localError ? (
        <p className="error-banner" role="alert">
          {localError}
        </p>
      ) : null}
      <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "1fr 1fr" }}>
        <label className="field">
          <span>Display name</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
      </div>
      <label style={{ display: "inline-flex", gap: "0.25rem", marginTop: "0.5rem" }}>
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        Active
      </label>
      <fieldset style={{ marginTop: "0.5rem" }}>
        <legend>Roles</legend>
        {roles.map((r) => (
          <label
            key={r.name}
            style={{ display: "inline-flex", gap: "0.25rem", marginRight: "0.75rem" }}
          >
            <input
              type="checkbox"
              checked={selected.includes(r.name)}
              onChange={(e) => {
                setSelected((prev) =>
                  e.target.checked ? [...prev, r.name] : prev.filter((n) => n !== r.name),
                );
              }}
            />
            {r.name}
          </label>
        ))}
      </fieldset>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
        <button type="button" className="btn btn-primary" disabled={pending} onClick={save}>
          Save changes
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={pending}
          onClick={() => onDelete(user.id)}
        >
          Delete user
        </button>
      </div>
      <hr style={{ margin: "0.75rem 0" }} />
      <div>
        <strong>Reset password</strong>
        <div className="muted" style={{ fontSize: "0.85em" }}>
          User will be forced to change on next login.
        </div>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
          <input
            type="text"
            value={resetPw}
            onChange={(e) => setResetPw(e.target.value)}
            placeholder="New temporary password"
            style={{ minWidth: "220px" }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={pending || !resetPw}
            onClick={doReset}
          >
            Reset password
          </button>
        </div>
      </div>
    </div>
  );
}
