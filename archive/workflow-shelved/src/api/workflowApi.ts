const API_BASE = import.meta.env.VITE_API_URL ?? "";

function authHeaders(): HeadersInit {
  const t = localStorage.getItem("workflow_auth_token");
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

export async function apiLogin(userId: string): Promise<{ token: string }> {
  const r = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<{ token: string }>;
}

export async function apiMe(): Promise<{
  user: { id: string; displayName: string; role: string; email: string | null };
}> {
  const r = await fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<{
    user: { id: string; displayName: string; role: string; email: string | null };
  }>;
}

export async function apiListUsers(): Promise<{ id: string; displayName: string; role: string }[]> {
  const r = await fetch(`${API_BASE}/api/users`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function apiSubmitSnapshot(snapshot: unknown): Promise<{
  id: string;
  status: string;
  currentQueue: string;
}> {
  const r = await fetch(`${API_BASE}/api/submissions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ snapshot }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function apiListSubmissions(): Promise<
  { id: string; status: string; currentQueue: string; actionTitle: string; updatedAt: string }[]
> {
  const r = await fetch(`${API_BASE}/api/submissions`, { headers: authHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export type WorkflowAction =
  | "send_to_city_council"
  | "request_dept_info"
  | "complete"
  | "review_completed"
  | "request_dept_info_council"
  | "further_information_planning"
  | "dept_submit_response";

export async function apiGetSubmission(id: string): Promise<{
  id: string;
  snapshot: Record<string, unknown>;
  status: string;
  currentQueue: string;
  availableActions: WorkflowAction[];
  workflowComments: string | null;
  councilToPlanningComments: string | null;
  fiAccessToken: string | null;
}> {
  const r = await fetch(`${API_BASE}/api/submissions/${id}`, { headers: authHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function apiTransition(
  id: string,
  body: {
    action: WorkflowAction;
    workflowComments?: string;
    councilToPlanningComments?: string;
  },
): Promise<{ ok: boolean; status: string; currentQueue: string }> {
  const r = await fetch(`${API_BASE}/api/submissions/${id}/transition`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t);
  }
  return r.json();
}

export function workflowDocumentUrl(id: string): string {
  return `${API_BASE}/api/submissions/${id}/document`;
}

export async function apiGetFi(token: string): Promise<{
  id: string;
  snapshot: Record<string, unknown>;
  workflowComments: string | null;
  status: string;
}> {
  const r = await fetch(`${API_BASE}/api/fi/${token}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function apiFiRespond(token: string, snapshot: unknown): Promise<unknown> {
  const r = await fetch(`${API_BASE}/api/fi/${token}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ snapshot }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
