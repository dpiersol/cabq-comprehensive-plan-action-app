import type Database from "better-sqlite3";
import type { FastifyRequest } from "fastify";
import {
  allowHeaderFallback,
  verifyAzureBearer,
  verifyAzureBearerWithConfig,
} from "./azureJwt.js";
import { verifyLocalBearer } from "./localSessionJwt.js";

export interface RequestOwner {
  ownerKey: string;
  email: string;
  oid?: string;
  /** Roles claimed by the caller. Populated from JWT (`roles`) or `X-User-Roles` header (mock/e2e). */
  roles: string[];
  /** Present when the caller authenticated via a local (non-SSO) session. */
  source?: "entra" | "local" | "header";
  /** Local users can be flagged to change their password at next login. */
  mustChangePassword?: boolean;
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
  return {
    ownerKey,
    email: email || "",
    oid,
    roles: rolesFromHeader(req),
    source: "header",
  };
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
export async function resolveOwner(
  req: FastifyRequest,
  db?: Database.Database,
): Promise<RequestOwner | null> {
  const bearer = extractBearer(req);
  if (bearer) {
    const local = await verifyLocalBearer(bearer);
    if (local) {
      return { ...local, source: "local" };
    }
    const entra = db
      ? await verifyAzureBearerWithConfig(db, bearer)
      : await verifyAzureBearer(bearer);
    if (entra) {
      return { ...entra, roles: entra.roles ?? [], source: "entra" };
    }
    return null;
  }
  if (allowHeaderFallback()) {
    return resolveOwnerFromHeaders(req);
  }
  return null;
}
