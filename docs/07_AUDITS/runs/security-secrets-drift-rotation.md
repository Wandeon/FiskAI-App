# Security: Secrets, Env Drift, and Rotation Readiness

## Inventory vs. Code Usage

| Status | Variable | Gap Detail | Evidence |
| --- | --- | --- | --- |
| ➕ Add to `.env.example` | `ADMIN_PASSWORD`, `ADMIN_EMAILS` | Used for admin access controls but not listed in the template. | `src/app/api/admin/auth/route.ts:4`, `src/lib/admin.ts:3`【F:src/app/api/admin/auth/route.ts†L4-L19】【F:src/lib/admin.ts†L1-L4】 |
| ➕ Add to `.env.example` | `APP_VERSION`, `LOG_LEVEL`, `NODE_ENV`, `PORT` | Runtime/version flags referenced in status/health endpoints and logging. | `src/app/api/status/route.ts:35`, `src/app/api/health/route.ts:68`, `sentry.server.config.ts:17`【F:src/app/api/status/route.ts†L32-L36】【F:src/app/api/health/route.ts†L64-L69】【F:sentry.server.config.ts†L16-L18】 |
| ➕ Add to `.env.example` | `DEEPSEEK_API_KEY`, `OLLAMA_API_KEY`, `OLLAMA_BASE_URL`, `OLLAMA_VISION_MODEL` | Additional AI providers supported in code but missing from the template. | `docs/_meta/inventory/env-vars.md:44-48`【F:docs/_meta/inventory/env-vars.md†L44-L48】 |
| ➕ Add to `.env.example` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Gmail OAuth configured for auth/email sync but absent from template (commented note only). | `docs/_meta/inventory/env-vars.md:95-96`【F:docs/_meta/inventory/env-vars.md†L95-L96】 |
| ➕ Add to `.env.example` | `IE_RACUNI_API_KEY`, `IE_RACUNI_API_URL`, `IE_RACUNI_SANDBOX` | E-invoice provider credentials configured in code but not in the template. | `docs/_meta/inventory/env-vars.md:118-122`【F:docs/_meta/inventory/env-vars.md†L118-L122】 |
| ➕ Add to `.env.example` | `FISCAL_PROVIDER` | Fiscalization provider switch referenced in code but not templated. | `docs/_meta/inventory/env-vars.md:113-115`【F:docs/_meta/inventory/env-vars.md†L113-L115】 |
| ➕ Add to `.env.example` | `SUDSKI_REGISTAR_CLIENT_ID`, `SUDSKI_REGISTAR_CLIENT_SECRET` | Registry lookup credentials needed for OIB lookup but not provided in template. | `docs/_meta/inventory/env-vars.md:147-152`【F:docs/_meta/inventory/env-vars.md†L147-L152】 |
| ➕ Add to `.env.example` | `APP_DOMAIN`, `AUTH_TRUST_HOST` | Deployment configs expect these values for Traefik/NextAuth trust, but they are not in the template. | `docker-compose.prod.yml:19-30`, `docker-compose.override.yml:12-17`【F:docker-compose.prod.yml†L19-L33】【F:docker-compose.override.yml†L12-L17】 |
| ➖ Remove or justify | `APP_PORT` | Present in template but unused across code and deployment manifests. | `.env.example:5`【F:.env.example†L1-L13】 |

## Deployment Config Drift

| Config | Env Expectations | Drift Observed | Evidence |
| --- | --- | --- | --- |
| docker-compose.prod.yml | Requires `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `EINVOICE_KEY_SECRET`; sets `AUTH_TRUST_HOST`. | Depends on `APP_DOMAIN` and `AUTH_TRUST_HOST` not documented in `.env.example`. | `docker-compose.prod.yml:13-33`【F:docker-compose.prod.yml†L13-L33】 |
| docker-compose.override.yml | Provides production defaults for DB/Auth/EInvoice secrets. | Hard-coded fallback secrets (`fiskai_secret_2025`, etc.) risk reuse and need rotation; also uses `APP_DOMAIN` implicitly. | `docker-compose.override.yml:5-17`【F:docker-compose.override.yml†L5-L17】 |
| docker-compose.dev.yml | Local dev credentials embedded. | Uses fixed secrets (`fiskai_dev_password`, dev NextAuth secret) diverging from `.env.example` values. | `docker-compose.dev.yml:4-21`【F:docker-compose.dev.yml†L4-L21】 |
| CI workflow | Uses `DATABASE_URL` and disables Sentry uploads. | `SENTRY_SKIP_SOURCE_MAP_UPLOAD` and `NODE_OPTIONS` not documented in `.env.example`; CI DB URL differs from template format. | `.github/workflows/ci.yml:11-47`【F:.github/workflows/ci.yml†L11-L47】 |
| K8s sample | Expects `NODE_ENV`, `DATABASE_URL`, `APP_VERSION` via secrets/config. | `APP_VERSION` required here but absent from `.env.example`. | `docs/deployment/health-checks-k8s.yaml:27-38`【F:docs/deployment/health-checks-k8s.yaml†L27-L38】 |

## Secrets Requiring Rotation

- **Hard-coded defaults** in `docker-compose.override.yml` and `docker-compose.dev.yml` (DB credentials, NextAuth secret, E-invoice secret) must be rotated and removed from repo-managed fallbacks; rely on external secret store instead.【F:docker-compose.override.yml†L5-L17】【F:docker-compose.dev.yml†L4-L21】  
- **Admin password default** (`Adminpass123!`) is embedded in code; rotate to env-only and invalidate any reuse.【F:src/app/api/admin/auth/route.ts†L4-L23】  
- **Repository-stored API tokens/credentials in AGENTS.md** indicate real values checked into docs; rotate in Coolify, database, and any third-party services, then purge from history if required.【F:AGENTS.md†L1-L104】  
- Ensure rotation for OAuth keys, Stripe secrets, R2 keys, and Sentry auth tokens once templated; current state provides placeholders only and no rotation process.

## Rotation Readiness Checklist

- [ ] Add missing variables to `.env.example` and `docs/_meta/inventory/env-vars.md` to keep inventory authoritative and prevent runtime surprises.  
- [ ] Remove hard-coded secrets from Compose overrides; source them from Coolify or CI secret stores and enforce `:?required` guards.  
- [ ] Document and implement rotation runbook (e.g., update Coolify secrets → redeploy → invalidate old tokens/keys, rotate database credentials, reissue NextAuth secret).  
- [ ] Introduce per-environment secret scoping (dev/staging/prod) and avoid shared placeholders like `fiskai_dev_password`.  
- [ ] Validate deployments against `.env.example` (CI job or script) to detect drift before deploy.  
- [ ] Add monitoring/check for expired credentials (Stripe webhook secret, Resend webhook secret, OAuth refresh).  
- [ ] Confirm `AUTH_TRUST_HOST` and `APP_DOMAIN` are documented and injected consistently across environments.

## Evidence Links

- `.env.example` baseline.【F:.env.example†L1-L73】  
- Environment inventory (out of date).【F:docs/_meta/inventory/env-vars.md†L3-L165】  
- Compose and CI configs showing drift.【F:docker-compose.prod.yml†L13-L33】【F:docker-compose.override.yml†L5-L17】【F:docker-compose.dev.yml†L4-L21】【F:.github/workflows/ci.yml†L11-L47】  
- K8s sample expects extra vars.【F:docs/deployment/health-checks-k8s.yaml†L27-L38】  
- Code paths using undocumented secrets.【F:src/app/api/admin/auth/route.ts†L4-L23】【F:src/lib/admin.ts†L1-L4】【F:src/app/api/status/route.ts†L32-L36】【F:src/app/api/health/route.ts†L64-L69】【F:sentry.server.config.ts†L16-L18】
