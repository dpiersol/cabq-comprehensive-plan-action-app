import { logout as clearSession, setAuthUser } from "../auth";

const STORAGE_KEY = "cabq.localSession.v1";

export interface LocalSession {
  accessToken: string;
  expiresAt: number;
  user: {
    id: string;
    username: string;
    email: string;
    displayName: string;
    roles: string[];
    mustChangePassword: boolean;
  };
}

let current: LocalSession | null = loadFromStorage();
restoreIfValid();

function loadFromStorage(): LocalSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as LocalSession;
    if (!s?.accessToken || typeof s.expiresAt !== "number") return null;
    return s;
  } catch {
    return null;
  }
}

function save(session: LocalSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function restoreIfValid(): void {
  if (!current) return;
  if (Date.now() >= current.expiresAt) {
    current = null;
    clearStorage();
    return;
  }
  setAuthUser({
    displayName: current.user.displayName,
    email: current.user.email,
    roles: current.user.roles,
    oid: `local:${current.user.id}`,
  });
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  user: {
    id: string;
    username: string;
    email: string;
    displayName: string;
    roles: string[];
    mustChangePassword: boolean;
  };
}

export async function loginLocal(identifier: string, password: string): Promise<LocalSession> {
  const res = await fetch("/api/auth/local/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) {
    let msg = "Sign-in failed.";
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const body = (await res.json()) as LoginResponse;
  const session: LocalSession = {
    accessToken: body.accessToken,
    expiresAt: Date.now() + body.expiresIn * 1000,
    user: body.user,
  };
  current = session;
  save(session);
  setAuthUser({
    displayName: body.user.displayName,
    email: body.user.email,
    roles: body.user.roles,
    oid: `local:${body.user.id}`,
  });
  return session;
}

export function getLocalSession(): LocalSession | null {
  if (!current) return null;
  if (Date.now() >= current.expiresAt) {
    current = null;
    clearStorage();
    return null;
  }
  return current;
}

export function getLocalAccessToken(): string | null {
  return getLocalSession()?.accessToken ?? null;
}

export function logoutLocal(): void {
  current = null;
  clearStorage();
  clearSession();
}

export function markPasswordChanged(): void {
  if (!current) return;
  current.user.mustChangePassword = false;
  save(current);
}

export async function changeLocalPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const token = getLocalAccessToken();
  if (!token) throw new Error("Not signed in with a local account.");
  const res = await fetch("/api/auth/local/change-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) {
    let msg = "Could not change password.";
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  markPasswordChanged();
}
