# Performance Audit: N+1, Pagination, and Pooling

## Endpoint Samples

- **Bank reconciliation transactions (`/api/banking/reconciliation`)**: uses validated query params with `page`, `limit` (default 25, max 100), counts total, and fetches matching transactions plus grouped counts. It additionally loads all outbound unpaid e-invoices with line items for candidate matching on every request.
- **Inbox e-invoices (`/api/e-invoices/inbox`)**: returns all delivered inbound invoices with full line and buyer details, logging the count but without pagination or limits.
- **Support tickets list (`/api/support/tickets`)**: fetches every ticket for the company that matches status filters, includes the most recent message, and does not impose a limit.
- **Invoices list action (`getInvoices` server action)**: cursor-paginates invoice lists with a default limit of 20 and a hard max of 100 while including buyer names.

## Pagination and Query Patterns

- Cursor pagination with strict caps is present in `getInvoices`, preventing oversized invoice page sizes.
- Reconciliation API enforces numeric validation and a hard max of 100 rows per page for transaction lists.
- Inbox e-invoices, support tickets, and exports fetch unbounded result sets; only the inbox endpoint logs the retrieved count, leaving others without guardrails or observability for large scans.

## N+1 and Heavy Query Risks

- Bank reconciliation auto-match action loops over every unmatched transaction and performs multiple per-transaction lookups (invoice, expense, recurring expense, and potential duplicate), creating N+1 traffic proportional to the unmatched set size.
- Reconciliation API loads the full set of outbound unpaid invoices with line items on every list request, pairing them client-side with the current page of transactions; this scales with total open invoices rather than the paginated slice.
- Support tickets and inbox invoice endpoints join related entities per item without pagination, so growth in ticket/invoice counts increases response payloads and DB load linearly.

## Pooling and Deployment Configuration

- Prisma is instantiated with the `pg` `Pool` (adapter `PrismaPg`) using the `DATABASE_URL`, and the pool is memoized in development to avoid exhausting connections across hot reloads.
- The Dockerfile ships a standalone Next.js build on Node 20, and `docker-compose.yml` provisions PostgreSQL; no alternative connection management layer is configured, so the application relies on the Node `pg` pool defaults alongside Prisma’s adapter.

## Findings

- Transaction lists and invoice cursor pagination are bounded and validated, but other high-traffic lists (support tickets, inbox e-invoices, exports) perform unbounded scans; except for inbox logging, they lack telemetry to prove scan sizes.
- Reconciliation workflows mix paginated transaction retrieval with whole-table invoice fetches and per-transaction lookups, posing N+1 and scaling risks for tenants with many open invoices or unmatched transactions.
- Connection pooling is present and aligned with the Node/Prisma runtime; however, explicit pool sizing and database connection limits are not defined in the compose or runtime configuration.
