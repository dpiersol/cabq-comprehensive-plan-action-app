import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

/** Stable owner identity extracted from a validated Entra access token. */
export interface JwtOwnerClaims {
  ownerKey: string;
  email: string;
  oid?: string;
  /** Entra app roles / group role claims (for admin gate). */
  roles: string[];
}

function rolesFromPayload(payload: JWTPayload): string[] {
  const raw = payload["roles"];
  if (Array.isArray(raw)) {
    return raw.filter((r): r is string => typeof r === "string");
  }
  if (typeof raw === "string" && raw) return [raw];
  return [];
}

function jwtModeConfigured(): boolean {
  return Boolean(process.env.AZURE_TENANT_ID?.trim());
}

/** When Entra JWT validation is configured, identity headers are ignored unless this is `"true"`. */
export function allowHeaderFallback(): boolean {
  if (!jwtModeConfigured()) return true;
  return process.env.ALLOW_HEADER_IDENTITY === "true";
}

function emailFromPayload(payload: JWTPayload): string {
  for (const key of ["preferred_username", "email", "upn"] as const) {
    const v = payload[key];
    if (typeof v === "string" && v.includes("@")) return v.trim().toLowerCase();
  }
  return "";
}

/** Validate an Azure AD access token (v2.0 issuer) and map claims to owner scope. */
export async function verifyAzureBearer(token: string): Promise<JwtOwnerClaims | null> {
  const tenant = process.env.AZURE_TENANT_ID?.trim();
  const audienceRaw =
    process.env.AZURE_AUDIENCE?.trim() ?? process.env.AZURE_CLIENT_ID?.trim();
  if (!tenant || !audienceRaw) return null;

  const issuer =
    process.env.AZURE_ISSUER?.trim() ?? `https://login.microsoftonline.com/${tenant}/v2.0`;
  const audiences = audienceRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (audiences.length === 0) return null;

  const JWKS = createRemoteJWKSet(
    new URL(`https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`),
  );

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer,
      audience: audiences.length === 1 ? audiences[0] : audiences,
    });
    const email = emailFromPayload(payload);
    const oid = typeof payload.oid === "string" ? payload.oid : undefined;
    if (!email && !oid) return null;
    const ownerKey = oid ? `oid:${oid}` : `email:${email}`;
    return { ownerKey, email: email || "", oid, roles: rolesFromPayload(payload) };
  } catch {
    return null;
  }
}
