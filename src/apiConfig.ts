/**
 * In development, call the Fastify API directly so Submit works even when the Vite `/api`
 * proxy fails (wrong host, port conflicts, or proxy quirks). Production builds use same-origin
 * `/api/...` for typical reverse-proxy deployment.
 *
 * Override with `VITE_API_ORIGIN` (e.g. `http://127.0.0.1:8787`) if your API port differs.
 */
const trimSlash = (s: string) => s.replace(/\/$/, "");

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!import.meta.env.DEV) {
    return p;
  }
  const raw = import.meta.env.VITE_API_ORIGIN;
  const origin =
    typeof raw === "string" && raw.trim().length > 0
      ? trimSlash(raw.trim())
      : "http://127.0.0.1:8787";
  return `${origin}${p}`;
}
