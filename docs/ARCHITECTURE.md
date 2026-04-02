# Architecture (1.1.x)

## User application (current)

- **React + Vite** SPA: **Comprehensive Plan** tab (form), **Library** tab (**Your submissions** — browser `localStorage`).
- **Fastify** API on port **8787**: `GET /api/health`, `POST /api/submissions/pdf` (PDF from merge payload). Vite **dev** and **preview** proxy `/api` to the API when it is running.

## Admin / back-end (planned)

- **Submissions management** for staff (review, export, workflow) will live in a separate area or service so it does not complicate the public-facing form.
- Placeholder: **`src/admin/README.md`**.

Future SSO-backed **Save for later** / per-user libraries can replace or supplement local-only storage without changing the merge/PDF contract.
