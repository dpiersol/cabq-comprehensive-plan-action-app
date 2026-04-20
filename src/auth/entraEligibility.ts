/**
 * Entra ID token claims helpers — eligibility for cabq.gov accounts.
 * Server-side validation must repeat these checks (never trust the client alone).
 */

/** Allowed email domains (comma-separated in VITE_ALLOWED_EMAIL_DOMAINS), default cabq.gov only. */
export function allowedEmailDomains(): string[] {
  const raw = import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS;
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  return ["cabq.gov"];
}

export function isAllowedEmailDomain(email: string): boolean {
  const lower = email.trim().toLowerCase();
  const at = lower.lastIndexOf("@");
  if (at < 0) return false;
  const domain = lower.slice(at + 1);
  return allowedEmailDomains().some((d) => domain === d);
}

export function getEmailFromClaims(claims: Record<string, unknown> | null | undefined): string | null {
  if (!claims) return null;
  const preferred = claims["preferred_username"];
  const email = claims["email"];
  const upn = claims["upn"];
  for (const v of [preferred, email, upn]) {
    if (typeof v === "string" && v.includes("@")) return v.trim().toLowerCase();
  }
  return null;
}

export function rolesFromIdTokenClaims(claims: Record<string, unknown> | null | undefined): string[] {
  if (!claims) return [];
  const roles = claims["roles"];
  if (Array.isArray(roles)) {
    return roles.filter((r): r is string => typeof r === "string");
  }
  if (typeof roles === "string" && roles) return [roles];
  return [];
}

export function isMockAuthMode(): boolean {
  if (import.meta.env.VITE_AUTH_MODE === "mock") return true;
  /** Playwright preview builds use `.env.e2e` via `vite build --mode e2e`. */
  if (import.meta.env.VITE_E2E_MOCK_AUTH === "true") return true;
  if (import.meta.env.DEV && !import.meta.env.VITE_AZURE_CLIENT_ID) return true;
  return false;
}
