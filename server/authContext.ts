import type { FastifyRequest } from "fastify";
import { allowHeaderFallback, verifyAzureBearer } from "./azureJwt.js";

export interface RequestOwner {
  ownerKey: string;
  email: string;
  oid?: string;
  /** Roles claimed by the caller. Populated from JWT (`roles`) or `X-User-Roles` header (mock/e2e). */
  roles: string[];
}

function rolesFromHeader(req: FastifyRequest): string[] {
  const raw = req.headers["x-user-roles"];
  if (typeof raw !== "string" || !raw.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Derive stable owner scope from trusted headers (used when JWT mode is off or ALLOW_HEADER_IDENTITY=true). */
export function resolveOwnerFromHeaders(req: FastifyRequest): RequestOwner | null {
  const emailRaw = req.headers["x-user-email"];
  const oidRaw = req.headers["x-user-oid"];
  const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
  const oid = typeof oidRaw === "string" && oidRaw.trim() ? oidRaw.trim() : undefined;
  if (!email && !oid) return null;
  const ownerKey = oid ? `oid:${oid}` : `email:${email}`;
  return { ownerKey, email: email || "", oid, roles: rolesFromHeader(req) };
}

function extractBearer(req: FastifyRequest): string | undefined {
  const auth = req.headers.authorization;
  if (typeof auth !== "string" || !auth.startsWith("Bearer ")) return undefined;
  const t = auth.slice(7).trim();
  return t || undefined;
}

/**
 * Resolve tenant-scoped owner: prefer validated Bearer token when sent; otherwise identity headers
 * when allowed (no Azure config, or ALLOW_HEADER_IDENTITY=true for migration / E2E).
 */
export async function resolveOwner(req: FastifyRequest): Promise<RequestOwner | null> {
  const bearer = extractBearer(req);
  if (bearer) {
    return verifyAzureBearer(bearer);
  }
  if (allowHeaderFallback()) {
    return resolveOwnerFromHeaders(req);
  }
  return null;
}
