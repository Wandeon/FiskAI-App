# Reliability & Error Handling Audit — Sentry

## Scope
- API routes (sampled 15 handlers across auth, AI, exports, monitoring, banking, cron, notifications).
- Background jobs (sampled 5 handlers across email sync, bank import processing, bank transaction deduplication, and fiscal processor).
- Sentry initialization and capture usage.
- User-facing error formatting and data exposure risks.

## Samples

| Area | Location | Pattern | Notes |
| --- | --- | --- | --- |
| API | `/api/health` | `withApiLogging` wrapper; internal try/catch per subsystem, no Sentry capture. | Structured JSON, but upstream errors would bubble through wrapper. 【F:src/app/api/health/route.ts†L1-L74】【F:src/lib/api-logging.ts†L1-L53】 |
| API | `/api/status` | `withApiLogging` with no try/catch; runtime errors would surface as 500 without custom formatting. | No Sentry capture; returns system metadata. 【F:src/app/api/status/route.ts†L1-L53】 |
| API | `/api/admin/auth` | No try/catch; direct JSON responses. | Defaults admin password; no logging or Sentry. 【F:src/app/api/admin/auth/route.ts†L1-L30】 |
| API | `/api/exports/company` | Explicit try/catch with logger; detailed `{error,details}` payload on failure. | No Sentry capture; may echo internal error messages. 【F:src/app/api/exports/company/route.ts†L1-L109】 |
| API | `/api/ai/extract` | `withApiLogging`; try/catch logs errors, returns `{error}`. | Rate-limit enforcement logged; no Sentry capture. 【F:src/app/api/ai/extract/route.ts†L1-L84】 |
| API | `/api/ai/suggest-category` | `withApiLogging`; try/catch with logger. | User/company context updates; no Sentry capture. 【F:src/app/api/ai/suggest-category/route.ts†L1-L52】 |
| API | `/api/ai/usage` | `withApiLogging`; try/catch with logger. | Returns usage JSON; no Sentry capture. 【F:src/app/api/ai/usage/route.ts†L1-L33】 |
| API | `/api/ai/feedback` (POST) | `withApiLogging`; schema validation; try/catch with logger. | Returns validation details; no Sentry. 【F:src/app/api/ai/feedback/route.ts†L1-L75】 |
| API | `/api/ai/feedback` (GET) | Same wrapper; try/catch with logger. | Returns stats/recent feedback; no Sentry. 【F:src/app/api/ai/feedback/route.ts†L77-L132】 |
| API | `/api/metrics` | `withApiLogging`; try/catch, logs error and serves fallback metrics payload. | No Sentry; exposes DB counts. 【F:src/app/api/metrics/route.ts†L1-L55】 |
| API | `/api/e-invoices/receive` | try/catch with logger around processing; returns `{error,details}`. | No Sentry capture; validation error details include field issues. 【F:src/app/api/e-invoices/receive/route.ts†L1-L127】【F:src/app/api/e-invoices/receive/route.ts†L129-L196】 |
| API | `/api/banking/reconciliation` | No try/catch; validation failures return `{error}`; other failures would surface raw. | No logging or Sentry. 【F:src/app/api/banking/reconciliation/route.ts†L1-L104】 |
| API | `/api/notifications` | `withApiLogging`; no try/catch, assumes downstream success. | Errors would surface without custom formatting or capture. 【F:src/app/api/notifications/route.ts†L1-L38】 |
| API | `/api/cron/email-sync` | try/catch with console logging; JSON error response. | No Sentry; secrets checked manually. 【F:src/app/api/cron/email-sync/route.ts†L1-L36】 |
| API | `/api/cron/bank-sync` | try/catch at route level plus nested per-account catches; console logging. | No Sentry; uses generic `{error}` responses. 【F:src/app/api/cron/bank-sync/route.ts†L1-L79】 |
| API | `/api/cron/fiscal-processor` | try/catch with console logging; processes jobs with retry classification. | No Sentry; raw errors stored to DB and returned generically. 【F:src/app/api/cron/fiscal-processor/route.ts†L1-L133】 |
| Jobs | Email sync (`syncEmailConnection`) | try/catch updates DB status; errors pushed to array, no logging/Sentry. | Attachment processing has inner try/catch; risk of silent failures. 【F:src/lib/email-sync/sync-service.ts†L19-L117】 |
| Jobs | Email sync aggregator (`syncAllConnections`) | Iterates connections without global try/catch around per-connection errors. | No instrumentation or Sentry. 【F:src/lib/email-sync/sync-service.ts†L232-L249】 |
| Jobs | Bank import processor (`processNextImportJob`) | try/catch updates status and logs to console; returns generic message. | No Sentry; uses broad error string in DB. 【F:src/lib/banking/import/processor.ts†L72-L127】 |
| Jobs | Bank transaction dedup (`processTransactionsWithDedup`) | No try/catch; throws bubble to caller. | No logging/Sentry; duplicate resolution errors thrown. 【F:src/lib/bank-sync/dedup.ts†L131-L184】 |
| Jobs | Fiscal processor (`processJob`) | try/catch classifies errors and persists; no external logging/Sentry. | Sensitive messages stored in DB; generic JSON response. 【F:src/app/api/cron/fiscal-processor/route.ts†L68-L133】 |

## Sentry configuration
- Sentry initialized for server, client, and edge runtimes with DSN from environment, production-only sending, and console integration on server. Sensitive headers are stripped in `beforeSend`. 【F:sentry.server.config.ts†L1-L35】【F:sentry.client.config.ts†L1-L35】【F:sentry.edge.config.ts†L1-L15】
- Next.js instrumentation imports the appropriate Sentry config per runtime. 【F:instrumentation.ts†L1-L10】
- Runtime capture usage is limited to the global app error boundary, which reports exceptions via `Sentry.captureException` and surfaces a generic user-facing message. 【F:src/app/global-error.tsx†L1-L36】

## Findings
1. **No Sentry capture in API handlers or background jobs.** Errors are logged via `logger` or `console` but never `captureException`, so production incidents are invisible to Sentry despite configuration. 【F:src/app/api/ai/extract/route.ts†L11-L84】【F:src/app/api/cron/fiscal-processor/route.ts†L1-L133】
2. **Inconsistent error formatting and coverage.** Several routes omit try/catch (`/api/status`, `/api/notifications`, `/api/banking/reconciliation`), allowing uncaught errors to bubble with framework defaults. Others return heterogeneous shapes (`{error}`, `{error,details}`, or plain text) leading to client inconsistency. 【F:src/app/api/status/route.ts†L1-L53】【F:src/app/api/notifications/route.ts†L1-L38】【F:src/app/api/banking/reconciliation/route.ts†L1-L104】【F:src/app/api/e-invoices/receive/route.ts†L1-L196】
3. **Sensitive or noisy error leakage risks.** Validation responses expose detailed schema issues (e.g., e-invoice receive) and raw error messages are persisted to DB in jobs (fiscal processor, import jobs) without sanitization. Without Sentry scrubbing in handlers, thrown errors may reach clients verbatim. 【F:src/app/api/e-invoices/receive/route.ts†L1-L196】【F:src/lib/banking/import/processor.ts†L85-L127】【F:src/app/api/cron/fiscal-processor/route.ts†L68-L133】
4. **Background jobs lack structured logging and observability.** Job handlers rely on console logging or silent error accumulation, with no correlation IDs or Sentry capture, making failure triage difficult. 【F:src/lib/email-sync/sync-service.ts†L19-L117】【F:src/lib/bank-sync/dedup.ts†L131-L184】
5. **Canonical helper exists but not paired with error policy.** `withApiLogging` standardizes request IDs and logging yet rethrows errors without consistent user payloads or Sentry capture, so consumers still see varied responses. 【F:src/lib/api-logging.ts†L15-L53】

## Recommended fixes
1. **Add centralized error handler wrapper.** Extend `withApiLogging` or introduce `withErrorHandling` to wrap responses in a consistent `{error, requestId}` shape, capture to Sentry (including context), and avoid leaking raw messages.
2. **Apply wrapper to all API routes.** Refactor routes missing try/catch (`/api/status`, `/api/notifications`, `/api/banking/reconciliation`, cron endpoints) to use the standardized wrapper and remove per-file console logs.
3. **Instrument background jobs.** Add Sentry capture plus structured logger usage inside `syncEmailConnection`, `processNextImportJob`, `processTransactionsWithDedup`, and fiscal `processJob`, including job identifiers and company IDs for tracing.
4. **Sanitize error payloads.** Replace raw `error.message` responses with generic user strings and server-side logs/Sentry for details; constrain validation error echoes to non-sensitive fields and avoid persisting external error bodies without redaction.
5. **Verify Sentry DSN presence in environments.** Ensure `SENTRY_DSN/NEXT_PUBLIC_SENTRY_DSN` are populated in staging/production so capture works once wired into handlers.
