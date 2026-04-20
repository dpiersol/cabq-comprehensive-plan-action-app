# Future work (not yet implemented)

Items called out by product / architecture discussions but **not in the current sprint scope**:

## Authentication and tenants

- **Additional Entra ID tenants** — e.g. City Council tenant distinct from City operations; configurable tenant allowlist + admin UI to register orgs (see roadmap / coordination plan).
- **Fine-grained roles** — Mayor’s office, City Council lens, departmental roles (~30 departments); initially plan for **application roles / groups** in Entra ID and map in UI + API RBAC.

## Collaboration and email

- **`mailto:` limitations** — Browsers cannot reliably attach generated Word/PDF to the default desktop mail client without native integration or **Microsoft Graph** (`Mail.Send`) with delegated permissions.
- **Graph-based email send** — Optional future path with admin consent for `Mail.Send`.

## Offline / UX

- **Offline draft sync** — Optional local queue when server-backed submissions land (Sprint 2+).

## Administrative

- **Template versioning** — Audit trail when admins change print templates (Sprint 5 area).
- **Reporting library** — Additional reports beyond initial 5–10 as needs emerge (“vibe code” friendly).
