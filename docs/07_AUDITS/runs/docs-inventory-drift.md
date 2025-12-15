# Docs Inventory Drift Audit

## Scope & Method
- Scope: `docs/_meta/inventory/*` compared against current repository code and configuration.
- Method: repo scan for `process.env` usage, runtime dependencies, cron definitions, and integration hooks; findings contrasted with documented inventory claims.

## Regenerated Facts
- **56 distinct environment variables** referenced in code/docs via `process.env`.【ddac61†L1-L2】
- APP/API routes present: **72 route handlers** under `src/app/api`.【08e282†L1-L2】
- Runtime dependency: Next.js **15.1** with Node.js toolchain (Docker base Node 20).【F:package.json†L57-L59】
- Sentry build config respects `CI` and `SENTRY_SKIP_SOURCE_MAP_UPLOAD` flags for source map uploads.【F:next.config.ts†L78-L87】
- Health/status endpoints surface `APP_VERSION` (fallbacks to `npm_package_version`).【F:src/app/api/health/route.ts†L64-L73】【F:src/app/api/status/route.ts†L33-L44】
- Import processing triggers use `PORT` when building localhost URLs for background work.【F:src/app/api/import/upload/route.ts†L77-L86】【F:src/app/api/import/jobs/[id]/type/route.ts†L55-L62】
- Bank sync docs reference `PLAID_WEBHOOK_URL` for webhook registration.【F:docs/02_FEATURES/features/integrations-bank-sync.md†L640-L655】
- Vercel cron config schedules **bank-sync** and **email-sync** only.【F:vercel.json†L1-L9】

## Drift Findings

### Environment Variables (env-vars.md)
| Claim | Observed | Classification | Evidence |
| --- | --- | --- | --- |
| Inventory states **58 env vars**, all covered by `.env.example`. | Scan shows **56** vars; `APP_VERSION`, `PORT`, `SENTRY_SKIP_SOURCE_MAP_UPLOAD`, `CI`, and `PLAID_WEBHOOK_URL` are used but absent from the inventory and `.env.example`. | Inventory incomplete / docs outdated | 【F:docs/_meta/inventory/env-vars.md†L1-L37】【ddac61†L1-L2】【F:src/app/api/health/route.ts†L64-L73】【F:next.config.ts†L78-L87】【F:src/app/api/import/upload/route.ts†L77-L86】【F:docs/02_FEATURES/features/integrations-bank-sync.md†L640-L655】 |
| Inventory highlights `APP_PORT` and `LOG_LEVEL` but omits mention of `APP_VERSION` surfaced on health/status endpoints. | Status/health routes read `APP_VERSION`; inventory tables do not list it. | Docs outdated | 【F:docs/_meta/inventory/env-vars.md†L28-L37】【F:src/app/api/health/route.ts†L64-L73】【F:src/app/api/status/route.ts†L33-L44】 |
| Sentry section documents `SENTRY_AUTH_TOKEN` only. | Build uses `SENTRY_SKIP_SOURCE_MAP_UPLOAD` toggle tied to CI. | Inventory incomplete | 【F:docs/_meta/inventory/env-vars.md†L65-L74】【F:next.config.ts†L78-L87】 |
| Bank sync inventory lacks Plaid webhook variable. | Plaid integration snippets rely on `PLAID_WEBHOOK_URL`. | Inventory incomplete | 【F:docs/02_FEATURES/features/integrations-bank-sync.md†L640-L655】 |

### Services & Runtimes (services.md, runtimes.md)
| Claim | Observed | Classification | Evidence |
| --- | --- | --- | --- |
| Framework listed as **Next.js 14+**. | `package.json` pins Next.js `^15.1.0`. | Docs outdated | 【F:docs/_meta/inventory/services.md†L11-L17】【F:docs/_meta/inventory/runtimes.md†L5-L16】【F:package.json†L57-L59】 |
| Background jobs: **bank-sync, email-sync, fiscal-processor** via Vercel Cron. | `vercel.json` schedules only **bank-sync** and **email-sync`; no fiscal-processor entry. | Docs outdated | 【F:docs/_meta/inventory/services.md†L32-L36】【F:vercel.json†L1-L9】 |
| Authentication providers listed as **Credentials, Google OAuth, WebAuthn** under NextAuth. | NextAuth config includes Credentials and optional Google; WebAuthn handled via dedicated API routes, not a NextAuth provider. | Docs outdated | 【F:docs/_meta/inventory/services.md†L25-L31】【F:src/lib/auth.ts†L9-L63】 |

### Integrations (integrations.md)
| Claim | Observed | Classification | Evidence |
| --- | --- | --- | --- |
| Sentry evidence tied to `.env.example` only. | Runtime Sentry config depends on `CI` and `SENTRY_SKIP_SOURCE_MAP_UPLOAD`, which are undocumented in the integration inventory. | Inventory incomplete | 【F:docs/_meta/inventory/integrations.md†L115-L124】【F:next.config.ts†L78-L87】 |

### Databases / ORM (databases.md)
- No mismatches detected. Prisma + PostgreSQL details and model/enum counts align with the current schema (38 models / 32 enums).【F:docs/_meta/inventory/databases.md†L1-L33】【63bb31†L1-L2】【6de339†L1-L2】

## Proposed Updates (not applied)
- Expand `docs/_meta/inventory/env-vars.md` and `.env.example` to include `APP_VERSION`, `PORT`, `SENTRY_SKIP_SOURCE_MAP_UPLOAD`, `CI`, and `PLAID_WEBHOOK_URL`; adjust total counts accordingly.
- Update service/runtime inventories to reflect Next.js 15.x, clarify that Vercel Cron schedules only bank-sync and email-sync, and distinguish WebAuthn API routes from NextAuth providers.
- Extend integration inventory to capture Sentry CI/source-map toggles.

## Drift Totals
- Categories with drift: **Environment variables**, **Services/Runtimes**, **Integrations**.
- Findings: 6 mismatches (4 env var gaps, 2 service/runtime inaccuracies, 1 integration omission; fiscal job counted within service/runtime drift).
