/**
 * Client-side dev-login helpers. These are intentionally isolated from
 * `localSession.ts` so that if `DevLoginPage.tsx` is not rendered in a
 * production build, nothing here is imported and the whole module is
 * tree-shaken out of the bundle.
 *
 * Dev-login is ONLY meant to run against a sandbox API that has
 * `ENABLE_DEV_LOGIN=true` set. The server guards against production use;
 * this client module simply talks to whichever API the SPA is served from.
 */

import { setAuthUser } from "../auth";

const STORAGE_KEY = "cabq.localSession.v1";

export type DevRole = "user" | "admin";

export interface DevLoginStatus {
  enabled: boolean;
}

export interface DevLoginResponse {
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

/** Client-side build flag. Set via `VITE_DEV_LOGIN_ENABLED=true` at build time. */
export function isDevLoginBuild(): boolean {
  return import.meta.env.VITE_DEV_LOGIN_ENABLED === "true";
}

/** Asks the server whether dev-login is enabled there (independent of the build flag). */
export async function fetchDevLoginStatus(): Promise<DevLoginStatus> {
  try {
    const res = await fetch("/api/auth/dev-login/status", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { enabled: false };
    const body = (await res.json()) as DevLoginStatus;
    return { enabled: Boolean(body?.enabled) };
  } catch {
    return { enabled: false };
  }
}

/**
 * Signs in as a synthetic dev user or dev admin. Stores the issued JWT
 * under the same storage key that `localSession.ts` uses, so the rest of
 * the app treats it exactly like a normal local session.
 */
export async function loginDev(role: DevRole): Promise<DevLoginResponse> {
  const res = await fetch("/api/auth/dev-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    let msg = "Dev login failed.";
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const body = (await res.json()) as DevLoginResponse;
  const session = {
    accessToken: body.accessToken,
    expiresAt: Date.now() + body.expiresIn * 1000,
    user: body.user,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
  setAuthUser({
    displayName: body.user.displayName,
    email: body.user.email,
    roles: body.user.roles,
    oid: `local:${body.user.id}`,
  });
  return body;
}
