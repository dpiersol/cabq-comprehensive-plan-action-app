import type { FastifyRequest } from "fastify";

export interface RequestOwner {
  ownerKey: string;
  email: string;
  oid?: string;
}

/** Derive stable owner scope from trusted headers (JWT validation comes in a later sprint). */
export function resolveOwner(req: FastifyRequest): RequestOwner | null {
  const emailRaw = req.headers["x-user-email"];
  const oidRaw = req.headers["x-user-oid"];
  const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
  const oid = typeof oidRaw === "string" && oidRaw.trim() ? oidRaw.trim() : undefined;
  if (!email && !oid) return null;
  const ownerKey = oid ? `oid:${oid}` : `email:${email}`;
  return { ownerKey, email: email || "", oid };
}
