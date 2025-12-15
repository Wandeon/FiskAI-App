# Multi-tenant Isolation Audit (INV-001, INV-002)

## Summary
- Checked: 20
- Confirmed: 17
- Partial: 2
- Unknown: 1

## Sampled routes and actions
| Entry point | Membership guard | Company scoping evidence | Result | Notes |
| --- | --- | --- | --- | --- |
| `createContact` (action) | `requireAuth` + `requireCompanyWithContext` set tenant context | Prisma extension injects `companyId` on `db.contact.create` | Confirmed | Context established before queries【F:src/app/actions/contact.ts†L9-L25】【F:src/lib/prisma-extensions.ts†L168-L215】 |
| `updateContact` (action) | Same as above | `findFirst`/`update` performed under tenant context | Confirmed | Filters injected for contact lookups【F:src/app/actions/contact.ts†L34-L57】【F:src/lib/prisma-extensions.ts†L176-L206】 |
| `deleteContact` (action) | Same as above | `findFirst`/`delete` under tenant context | Confirmed | Tenant filtering applies to reads/writes【F:src/app/actions/contact.ts†L60-L78】【F:src/lib/prisma-extensions.ts†L176-L215】 |
| `createInvoice` (action) | `requireAuth` + `requireCompanyWithContext` | All Prisma calls within tenant context; companyId auto-set | Confirmed | Uses tenant context for buyer lookup and create【F:src/app/actions/invoice.ts†L35-L110】【F:src/lib/prisma-extensions.ts†L176-L215】 |
| `updateInvoice` (action) | Same guard | `findFirst`/`update` in tenant context | Confirmed | Middleware scopes invoice reads/updates【F:src/app/actions/invoice.ts†L193-L259】【F:src/lib/prisma-extensions.ts†L176-L215】 |
| `createProduct` (action) | `requireAuth` + `requireCompanyWithContext` | `db.product.create` scoped via tenant context | Confirmed | Context ensures companyId injection【F:src/app/actions/product.ts†L20-L37】【F:src/lib/prisma-extensions.ts†L176-L215】 |
| `deleteProduct` (action) | Same guard | `findFirst`/`delete` scoped | Confirmed | Tenant filter hides cross-company ids【F:src/app/actions/product.ts†L112-L130】【F:src/lib/prisma-extensions.ts†L176-L215】 |
| `createExpense` (action) | `requireAuth` + `requireCompanyWithContext` | Category lookup includes `companyId` OR; other ops in tenant context | Confirmed | Explicit companyId in category query plus middleware【F:src/app/actions/expense.ts†L33-L88】【F:src/lib/prisma-extensions.ts†L176-L215】 |
| `deleteExpense` (action) | `requireCompanyWithPermission` | `findFirst`/`delete` in tenant context | Confirmed | Permission + tenant scope on reads/writes【F:src/app/actions/expense.ts†L151-L178】【F:src/lib/prisma-extensions.ts†L176-L215】 |
| `fiscalizeInvoice` (action) | `requireAuth` + `requireCompany` | Fetch uses `companyId` but final `update` only filters by `id` | Partial | Update could touch another tenant’s invoice if id guessed【F:src/app/actions/fiscalize.ts†L18-L187】 |
| `POST /api/products/import` | Auth via `getCurrentUser`; company via `getCurrentCompany` | `companyId` injected manually in create payload | Confirmed | Writes include explicit companyId【F:src/app/api/products/import/route.ts†L20-L65】 |
| `GET /api/e-invoices/inbox` | `requireAuth` + `requireCompany` | Query filters `companyId` for inbox records | Confirmed | companyId enforced in findMany【F:src/app/api/e-invoices/inbox/route.ts†L16-L45】 |
| `POST /api/e-invoices/inbox` | Same guard | Lookup scoped by `companyId`; `update` uses `id` only | Partial | Update lacks companyId constraint after check【F:src/app/api/e-invoices/inbox/route.ts†L57-L142】 |
| `POST /api/receipts/upload` | `auth` + `requireCompany` | Storage key prefixed with companyId; no DB writes | Confirmed | Company verified before generating key【F:src/app/api/receipts/upload/route.ts†L14-L75】 |
| `POST /api/ai/extract` | Session auth; fetches default company | Uses companyId for rate limits; no tenant context or DB writes | Confirmed | Company retrieved before AI processing【F:src/app/api/ai/extract/route.ts†L11-L77】 |
| `GET /api/ai/usage` | Session auth; fetches default company | Uses companyId for `getUsageLimits` but implementation not shown | Unknown | Cannot verify downstream scoping【F:src/app/api/ai/usage/route.ts†L9-L44】 |
| `GET /api/exports/invoices` | `getCurrentUser` + `getCurrentCompany` | `eInvoice.findMany` filtered by `companyId` | Confirmed | Query constrains companyId【F:src/app/api/exports/invoices/route.ts†L39-L145】 |
| `POST /api/bank/connect` | `requireAuth` + `requireCompany`; tenant context set | Queries/creates filter/include `companyId` | Confirmed | setTenantContext plus explicit filters【F:src/app/api/bank/connect/route.ts†L9-L95】【F:src/lib/prisma-extensions.ts†L176-L215】 |
| `GET /api/support/tickets` | `getCurrentUser` + `getCurrentCompany` | `findMany` filtered by `companyId` | Confirmed | companyId enforced in query【F:src/app/api/support/tickets/route.ts†L13-L49】 |
| `POST /api/billing/checkout` | `auth` + `requireCompany` | CompanyId passed to billing service | Confirmed | Guarded before using company.id【F:src/app/api/billing/checkout/route.ts†L10-L44】 |

## Findings
- **Partial isolation during fiscalization (Medium):** `fiscalizeInvoice` updates invoices with `where: { id: invoiceId }` after a scoped read. An attacker who learns another tenant’s invoice ID could reuse the action to update it. Add `companyId: company.id` to the update filter or run the action inside `runWithTenant` so Prisma enforces scoping automatically.【F:src/app/actions/fiscalize.ts†L18-L187】
- **Inbox status updates missing company filter (Medium):** `POST /api/e-invoices/inbox` validates ownership via `findFirst` but performs the `update` by `id` only. Include `companyId: company.id` (or run inside tenant context) in the update where clause to prevent cross-tenant writes.【F:src/app/api/e-invoices/inbox/route.ts†L57-L142】
- **AI usage scoping uncertain (Low):** `GET /api/ai/usage` retrieves a companyId but delegates to `getUsageLimits` without visible safeguards. Review that helper to ensure it enforces companyId filtering or wrap the route in tenant context middleware.【F:src/app/api/ai/usage/route.ts†L9-L44】

## Evidence
- Tenant identifier fields defined on models (e.g., `companyId` on `CompanyUser`, `Contact`, invoices, etc.)【F:prisma/schema.prisma†L68-L140】
- Prisma tenant extension injects `companyId` filters and defaults for scoped models; used via `withTenantIsolation` in `db` client【F:src/lib/prisma-extensions.ts†L5-L215】【F:src/lib/db.ts†L1-L19】
- Membership helpers (`requireCompanyWithContext`, `requireCompanyWithPermission`) set tenant context for actions【F:src/lib/auth-utils.ts†L12-L135】
- Entry-point specific guards and scoping shown in table rows above with citations.
