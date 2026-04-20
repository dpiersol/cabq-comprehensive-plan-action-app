# Ops Request - DNS, TLS Certificate, Firewall, and SMTP for CABQ Comprehensive Plan Action App (Dev)

**Submit to:** CABQ IT Operations / Infrastructure team (ticket system or
the appropriate DL).

**Submitter:** <your name, email, phone, Dept>

**Priority:** Standard.

**Environment:** Internal development. All access is internal-only (CABQ
network + VPN). Do not publish any DNS record externally.

---

## Summary

We are standing up an internal dev site so staff can review the in-progress
Comprehensive Plan Action App before production cutover. The app is
already running on **DTIAPPSINTDEV** (IIS + PM2 + Fastify). It is currently
reachable only as `http://DTIAPPSINTDEV:8080`, which is not friendly for
end users.

We need **four things** from Ops to finish the cutover to
`https://cpactions-dev.cabq.gov`:

1. DNS - add an internal record
2. TLS certificate - issue a cert for the new hostname
3. Firewall - open inbound 443 to DTIAPPSINTDEV from the CABQ network
4. SMTP relay - tell us how to send email from the app (for future
   notifications; no immediate change needed today)

Each request below is self-contained. Please address them in that order -
DNS and cert are blocking for the app owner; firewall and SMTP can
follow the same ticket or a separate one, whichever matches your
workflow.

---

## Request 1 - Internal DNS record

Create an internal DNS record:

| Field | Value |
|---|---|
| Hostname | `cpactions-dev.cabq.gov` |
| Type | A record (preferred) OR CNAME pointing at the server's canonical FQDN |
| Target | Internal IP of `DTIAPPSINTDEV` (or `DTIAPPSINTDEV.cabq.gov` if CNAME is preferred) |
| Scope | **Internal zone only.** Must NOT be published to external DNS. |
| TTL | Whatever is standard for CABQ internal zones (e.g., 3600 s). |

Please confirm back to us:
- Which record type you created (A vs CNAME).
- The exact FQDN we should use in our application configuration.
- Whether internal DNS change takes effect immediately or needs a
  propagation wait.

### Production cutover (for your awareness, not action today)

When we later stand up production, we will ask for the same record as
`cpactions.cabq.gov` pointing at `DTIAPPSINTPRD`. Whatever pattern you use
for dev we will reuse for production.

---

## Request 2 - TLS certificate for `cpactions-dev.cabq.gov`

Please issue a TLS server certificate for the hostname
`cpactions-dev.cabq.gov`.

### Required cert properties

| Field | Value |
|---|---|
| Subject Common Name (CN) | `cpactions-dev.cabq.gov` |
| Subject Alternative Names (SAN) | must include at least `DNS:cpactions-dev.cabq.gov` |
| Key usage | Server Authentication (EKU 1.3.6.1.5.5.7.3.1) |
| Key size / algorithm | RSA 2048 or ECDSA P-256, whichever is standard at CABQ |
| Validity | Whatever CABQ standard is for internal certs (1 year typical) |
| Installed on | `DTIAPPSINTDEV` (IIS machine store, personal) |

### Delivery format

**Preferred:** `.pfx` (PKCS#12) containing both the certificate and the
private key, password-protected, delivered over a secure channel (not
plaintext email). IIS will import this directly.

**Acceptable alternate:** separate `.cer` / `.crt` and `.key` files
bundled with any required intermediates; we will convert to `.pfx` on the
server.

### Questions back to you

Please answer these so we can document the process for future renewals:

1. **How does CABQ issue internal certs?**
   - Internal CA (Active Directory Certificate Services)?
   - External CA (DigiCert, Sectigo, Let's Encrypt, etc.) paid for by
     IT?
   - Wildcard certificate `*.cabq.gov` shared across services?
2. **Is DTIAPPSINTDEV auto-enrolled** (certs delivered via AD group
   policy) or does Ops deliver a one-off file?
3. **Expiration and renewal** - what is the expiry date of the cert you
   issue, and who should we contact 30 days before it expires?
4. **Internal CA trust** - does CABQ's internal CA root cert get pushed
   to workstations via AD group policy so browsers trust it
   automatically? If not, reviewers will see cert warnings.
5. **Production cert** - should we request `cpactions.cabq.gov` now as
   part of the same cert request (SAN on the dev cert), or as a separate
   cert when production is ready? We recommend **separate certs** so dev
   rotations don't affect prod.

---

## Request 3 - Firewall rule

Please open the following inbound rule on `DTIAPPSINTDEV`:

| Field | Value |
|---|---|
| Direction | Inbound |
| Protocol | TCP |
| Port | 443 |
| Source | CABQ internal network (LAN + VPN subnets; NOT internet) |
| Destination | `DTIAPPSINTDEV` |
| Action | Allow |
| Rule name suggestion | `App-CPActions-443-In-TCP` |

**Do not remove** the existing rule for TCP 8080 during the cutover - we
want to fall back to the old URL if anything goes wrong. We will ask you
to remove it in a follow-up ticket once the new URL is verified.

---

## Request 4 - SMTP relay (for future email notifications)

The app does not send email today, but we will be adding user and admin
notifications (e.g., "your submission was received", "admin password
reset"). To build that feature we need the following info from Ops:

| Question | Why we need it |
|---|---|
| What is the CABQ **SMTP relay hostname**? (e.g., `smtp.cabq.gov`) | App configuration |
| What **port** does it accept submissions on? (25, 587, 465) | App configuration |
| Does it require **TLS/STARTTLS**? | App configuration |
| Does it require **authentication**? If yes, what method (basic, OAuth, IP allow-list)? | App configuration and credential request |
| What **From addresses** are we allowed to send as? We would like a dedicated sender like `comp-plan-noreply@cabq.gov`. | Anti-spoofing / SPF alignment |
| Is **DTIAPPSINTDEV** already allow-listed to relay, or does it need to be added? | Server-side enable |
| Can Ops provision a shared mailbox `comp-plan-support@cabq.gov` that we can use as the `Reply-To` address and staff as needed? | User support |

We are **not asking to send email yet** - just to get the relay info
documented so we can configure the environment in advance. The app will
ship with notifications disabled by default (`NOTIFICATIONS_ENABLED=false`)
and we will coordinate with Ops before turning it on.

---

## Verification (what we will do after you are done)

After Ops confirms these are complete, the app owner will:

1. Run `Resolve-DnsName cpactions-dev.cabq.gov` from a CABQ workstation
   and confirm the IP.
2. Run `Test-NetConnection cpactions-dev.cabq.gov -Port 443` and confirm
   `TcpTestSucceeded: True`.
3. Import the PFX, add the HTTPS binding, rebuild the SPA, redeploy, and
   sign in as a test user.
4. Reply to this ticket with the verified URL once it works, so Ops can
   close the request.

---

## Contacts

| Role | Name | Email |
|---|---|---|
| App owner | <your name> | <your email> |
| App backup / Entra admin | <peer name> | <peer email> |
| Emergency | <manager> | <manager email> |

---

## Reference

- App technical manual: [deployment/MANUAL-DEPLOY.md](MANUAL-DEPLOY.md)
- Post-cert steps owned by the app team: [deployment/PUBLISH-TO-DEV-DNS.md](PUBLISH-TO-DEV-DNS.md)
- Email/notifications roadmap (what we will build after Ops answers
  Request 4): [docs/EMAIL-NOTIFICATIONS-ROADMAP.md](../docs/EMAIL-NOTIFICATIONS-ROADMAP.md)
