import { SignJWT, jwtVerify } from "jose";
import type { RequestOwner } from "./authContext.js";

/** Fixed issuer + audience strings for the local-session token. */
const ISSUER = "cabq-plan-local";
const AUDIENCE = "cabq-plan-api";

const DEFAULT_TTL_SECONDS = 8 * 60 * 60;

function secretBytes(): Uint8Array | null {
  const raw = process.env.LOCAL_JWT_SECRET?.trim();
  if (!raw) return null;
  if (raw.length < 32) {
    console.warn(
      "[local-session] LOCAL_JWT_SECRET is shorter than 32 chars; please set a stronger secret for production.",
    );
  }
  return new TextEncoder().encode(raw);
}

export function localSessionTtlSeconds(): number {
  const raw = process.env.LOCAL_JWT_TTL_SECONDS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 60 && n <= 24 * 60 * 60) return n;
  }
  return DEFAULT_TTL_SECONDS;
}

/** Is the local-session JWT facility configured (secret available)? */
export function localSessionConfigured(): boolean {
  return secretBytes() !== null;
}

export interface LocalSessionClaims {
  sub: string;
  email: string;
  username: string;
  displayName: string;
  roles: string[];
  mustChangePassword: boolean;
}

export async function signLocalSession(claims: LocalSessionClaims): Promise<string> {
  const secret = secretBytes();
  if (!secret) {
    throw new Error(
      "LOCAL_JWT_SECRET is not set. Configure a random secret (>= 32 bytes) to enable local sign-in.",
    );
  }
  return new SignJWT({
    email: claims.email,
    username: claims.username,
    displayName: claims.displayName,
    roles: claims.roles,
    mustChangePassword: claims.mustChangePassword,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${localSessionTtlSeconds()}s`)
    .sign(secret);
}

/**
 * Verify a local-session token. Returns a `RequestOwner` shaped like the
 * Azure variant so it can drop straight into `resolveOwner()` without the
 * admin / submission code needing to know which source issued the token.
 */
export async function verifyLocalBearer(
  token: string,
): Promise<(RequestOwner & { mustChangePassword: boolean }) | null> {
  const secret = secretBytes();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    if (!sub) return null;
    const email = typeof payload.email === "string" ? payload.email : "";
    const rolesRaw = payload.roles;
    const roles = Array.isArray(rolesRaw)
      ? rolesRaw.filter((r): r is string => typeof r === "string")
      : [];
    return {
      ownerKey: `local:${sub}`,
      email,
      oid: undefined,
      roles,
      mustChangePassword: Boolean(payload.mustChangePassword),
    };
  } catch {
    return null;
  }
}
