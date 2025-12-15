# Performance Audit

Scope: runtime data fetching, database interactions, and build/deployment configuration that impact perceived speed and resource usage.

## Findings
1. **Extra round-trips for contacts data** – The new invoice page fetches contacts from the client bundle (`src/app/(dashboard)/e-invoices/new/page.tsx:12-55`). Every render triggers a server action call over the network, even though the page is an async server component that could preload contacts once during SSR. Move the query to the server side (or expose a paginated API) to avoid duplicate fetches and improve TTFB.
2. **No pagination or limits on invoice queries** – `getEInvoices` (`src/app/actions/e-invoice.ts:145-165`) returns every invoice for a company with full relations. As data grows, responses will balloon and tank both DB and rendering performance. Introduce pagination (cursor/limit), expose filters in the UI, and default to, e.g., the last 50 records.
3. **Loading unused relations** – The list view only needs buyer name, totals, and status, yet `getEInvoices` includes `seller` and every `line` (`src/app/actions/e-invoice.ts:158-162`). Pulling all child rows on every list request increases query time and JSON size. Use `select` to fetch only the fields needed for each screen, and lazily load line items when opening an invoice detail.
4. **Duplicated authentication queries** – Pages such as `src/app/(dashboard)/e-invoices/page.tsx` already resolve `requireAuth`/`requireCompany`, but calling `getEInvoices()` performs the same checks again (`src/app/actions/e-invoice.ts:145-165`). This results in two DB hits and two session validations per request. Refactor helpers to accept the resolved `companyId` to cut redundant work.
5. **Build image misses production dependency pruning** – Dockerfile copies the entire `node_modules` directory from the build stage into the runner (`Dockerfile:14-48`) without running `npm prune --production` or using `npm ci --omit=dev`, so the final image ships devDependencies and wastes memory. Prune dev packages before copying to the runtime layer to shrink startup footprint.

## Recommendations
- Server-render contacts/products for forms, or provide paginated API endpoints consumed via React Query with caching.
- Add pagination, filtering, and field selection to invoice queries; only include detailed relations when explicitly requested.
- Pass authenticated context to helper functions to skip redundant queries.
- Optimize Docker build by installing prod dependencies only for the runner image (e.g., `npm ci --omit=dev` in a dedicated stage).
- Monitor Prisma query performance (enable logs/metrics) once pagination lands to validate improvements.
