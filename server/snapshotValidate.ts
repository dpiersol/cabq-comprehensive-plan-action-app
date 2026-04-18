/** Minimal structural check before persisting (full UI validation stays client-side). */
export function snapshotFromRequestBody(body: unknown): unknown {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object");
  }
  const b = body as Record<string, unknown>;
  const snap = b.snapshot;
  if (!snap || typeof snap !== "object") {
    throw new Error('Body must include a "snapshot" object');
  }
  const o = snap as Record<string, unknown>;
  if (!Array.isArray(o.planItems)) {
    throw new Error("snapshot.planItems must be an array");
  }
  return snap;
}
