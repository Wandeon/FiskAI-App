# OWASP Top 10 Review (A01-A10)

Scope: API input validation & query building, Prisma usage, authentication & access control, output encoding/XSS, dependencies, logging/monitoring.

## Checklist (status = confirmed / partial / unknown)
- **A01 Broken Access Control:** Partial — tenant scoping and RBAC present, but gaps in createMany/updateMany enforcement and limited auth checks on some routes.
- **A02 Cryptographic Failures:** Partial — bcrypt and AES-GCM used, but hard-coded Sudski Registar secrets and no rotation/checks surfaced.
- **A03 Injection:** Partial — Prisma ORM mitigates SQL injection; input validation on several endpoints, but dynamic filters/dates lack schema validation and no query safelists.
- **A04 Insecure Design:** Partial — tenant isolation/audit pipeline present, yet missing design docs for abuse cases and no threat modeling evidence.
- **A05 Security Misconfiguration:** Partial — request logging with IDs exists; reliance on in-memory rate limiting and default secrets indicates misconfig risk.
- **A06 Vulnerable/Outdated Components:** Unknown — package versions listed but no SCA/audit workflow evidence.
- **A07 Identification & Authentication Failures:** Partial — NextAuth with rate limits and session binding present; no MFA enforcement beyond WebAuthn opt-in, and no password reset hardening noted.
- **A08 Software & Data Integrity Failures:** Partial — audit logging and tenant filters exist, but no signed releases or integrity checks on imports.
- **A09 Security Logging & Monitoring Failures:** Partial — structured logging with context exists; no alerting, retention, or anomaly monitoring documented.
- **A10 Server-Side Request Forgery (SSRF):** Partial — external lookups use fetch with timeouts, but user-supplied URLs are not centrally validated/safelisted.

## Category Evidence & Notes
### A01 Broken Access Control
- Prisma tenant extension automatically injects `companyId` filters for most query types and hides cross-tenant records.【F:src/lib/prisma-extensions.ts†L52-L257】
- `requireCompanyWithPermission` combines auth, tenant context, and permission checks before executing callbacks.【F:src/lib/auth-utils.ts†L46-L92】
- Support ticket API restricts queries by company and status but relies on session presence only (no per-action permission).【F:src/app/api/support/tickets/route.ts†L13-L80】

### A02 Cryptographic Failures
- Login flow verifies bcrypt password hashes via Prisma-backed lookup.【F:src/lib/auth.ts†L24-L72】
- Encryption helper uses AES-256-GCM with key derived from `EINVOICE_KEY_SECRET` (throws if missing).【F:src/lib/secrets.ts†L1-L32】
- Sudski Registar client IDs/secrets have hard-coded defaults in code, risking exposure if env vars unset.【F:src/lib/oib-lookup.ts†L24-L34】

### A03 Injection
- Support ticket creation validates body with Zod before Prisma create, reducing injection vectors.【F:src/app/api/support/tickets/route.ts†L7-L80】
- OIB lookup endpoint validates format and limits rate before calling external APIs, mitigating injection into downstream services.【F:src/app/api/oib/lookup/route.ts†L4-L99】
- Report filters build Prisma queries directly from URL params without schema validation (date parsing only), leaving room for unexpected input handling paths.【F:src/app/api/reports/kpr/route.ts†L1-L22】【F:src/lib/reports/kpr.ts†L38-L116】

### A04 Insecure Design
- Tenant context and audit logging are baked into Prisma extension design to enforce isolation and traceability.【F:src/lib/prisma-extensions.ts†L52-L257】
- Server action wrapper propagates request/user context and logs failures, shaping a defensive pattern for new actions.【F:src/lib/server-action.ts†L1-L42】
- No documented threat modeling/abuse-case handling for high-risk flows (e.g., banking imports) observed in repo (gap).

### A05 Security Misconfiguration
- Middleware assigns request IDs and response-time headers while logging inbound requests.【F:src/middleware.ts†L5-L25】
- Logging redacts secrets/password fields from structured output to avoid leakage.【F:src/lib/logger.ts†L21-L36】
- Several security controls rely on in-memory state (rate limiting) and default credentials in code, which would reset across instances and risk exposure.【F:src/app/api/oib/lookup/route.ts†L4-L40】【F:src/lib/oib-lookup.ts†L24-L34】

### A06 Vulnerable/Outdated Components
- Dependencies include numerous third-party packages (Next.js 15.x, Prisma 7.x, etc.) but no `npm audit`, `snyk`, or Dependabot workflow is defined in scripts.【F:package.json†L1-L71】
- No SBOM or lockfile integrity checks are referenced in repo docs (gap).
- No container scanning or supply-chain pipeline files found in root (gap).

### A07 Identification & Authentication Failures
- NextAuth configuration enforces credential checks and rate limits per login identifier.【F:src/lib/auth.ts†L24-L76】
- Session callback binds user ID into session token for downstream authorization checks.【F:src/lib/auth.ts†L92-L104】
- WebAuthn/passkey support is only implicit via password prefix handling; no MFA requirement or recovery policy evident (gap).【F:src/lib/auth.ts†L38-L54】

### A08 Software & Data Integrity Failures
- Prisma extension queues audit logs for create/update/delete across key models, recording company/user context.【F:src/lib/prisma-extensions.ts†L95-L166】【F:src/lib/prisma-extensions.ts†L207-L257】
- Reports and exports are generated server-side without signed outputs or checksums (e.g., KPR CSV).【F:src/app/api/reports/kpr/route.ts†L1-L22】
- In-memory rate limiting and absence of tamper-evident logs/alerts leave integrity controls unenforced across restarts.【F:src/app/api/oib/lookup/route.ts†L4-L40】【F:src/lib/logger.ts†L21-L36】

### A09 Security Logging & Monitoring Failures
- Middleware and API logging wrap requests with request IDs, methods, and durations for traceability.【F:src/middleware.ts†L5-L25】【F:src/lib/api-logging.ts†L13-L40】
- Logger mixes context (userId/companyId) into structured logs and redacts secrets.【F:src/lib/logger.ts†L21-L36】
- No evidence of log shipping, alerting, or monitoring pipelines; console logging used for auth events only.【F:src/lib/auth.ts†L106-L115】

### A10 Server-Side Request Forgery (SSRF)
- OIB lookup fetches external VIES and Sudski endpoints using user-supplied OIB; request URL is constructed directly after format validation.【F:src/lib/oib-lookup.ts†L51-L121】【F:src/app/api/oib/lookup/route.ts†L64-L89】
- Sudski token retrieval uses fixed URLs without egress restrictions; no SSRF allowlist present.【F:src/lib/oib-lookup.ts†L24-L71】
- No centralized HTTP client hardening (no DNS pinning/proxy/egress filtering) observed for other outbound integrations (gap).

## Risks & Recommendations
- **Tenant isolation gaps (A01, High):** `createMany/updateMany/deleteMany` rely on extensions but routes may bypass `runWithTenant`; add middleware ensuring tenant context set for every request and enforce permission checks per action (e.g., support tickets).【F:src/lib/prisma-extensions.ts†L258-L350】【F:src/app/api/support/tickets/route.ts†L13-L80】
- **Hard-coded external credentials (A02, High):** Sudski Registar defaults embedded in code risk leakage; require env vars at startup and fail closed when missing, with secret rotation guidance.【F:src/lib/oib-lookup.ts†L24-L34】
- **Weak SSRF posture (A10, Medium):** External fetches build URLs from user input; implement allowlists/proxy and server-side validation for outbound calls, including timeout and hostname verification on all HTTP clients.【F:src/lib/oib-lookup.ts†L51-L121】【F:src/app/api/oib/lookup/route.ts†L64-L89】
- **Lack of dependency scanning (A06, Medium):** Add CI jobs for `npm audit --production`/`pnpm audit`, Dependabot/Snyk, and SBOM generation to detect vulnerable components.【F:package.json†L1-L71】
- **In-memory rate limiting/logging only (A05/A09, Medium):** Move rate-limit and audit logs to durable stores (Redis/DB) with alerting on abuse; add retention/monitoring policies and redact-sensitive fields consistently across services.【F:src/app/api/oib/lookup/route.ts†L4-L58】【F:src/lib/logger.ts†L21-L36】
- **Input validation coverage (A03, Medium):** Introduce Zod/Yup schemas for report filters and other query parameters, and centralize validation for Prisma queries to prevent unexpected type coercion or logic injection.【F:src/app/api/reports/kpr/route.ts†L10-L22】【F:src/lib/reports/kpr.ts†L38-L116】
- **Authentication assurance (A07, Medium):** Enforce MFA/WebAuthn enrollment for sensitive operations, add account lockout notifications, and strengthen password reset flows with signed tokens and audit events.【F:src/lib/auth.ts†L24-L115】
- **Integrity of exports (A08, Low):** Sign generated files (hash/metadata) and store audit trails of downloads to detect tampering.【F:src/app/api/reports/kpr/route.ts†L1-L22】

