# Reliability audit: Cron auth & idempotency (INV-005)

## Job inventory and authorization

- **Fiscal processor** (`/api/cron/fiscal-processor`, GET): requires `Authorization: Bearer <CRON_SECRET>` and rejects otherwise. 【F:src/app/api/cron/fiscal-processor/route.ts†L10-L65】
- **Bank sync** (`/api/cron/bank-sync`, POST/GET): checks `CRON_SECRET` when present, then syncs connected accounts. 【F:src/app/api/cron/bank-sync/route.ts†L8-L118】
- **Email sync** (`/api/cron/email-sync`, GET): checks `CRON_SECRET` when present, then syncs all email connections. 【F:src/app/api/cron/email-sync/route.ts†L6-L38】

**Authorization findings**

- Fiscal processor is hard-blocked unless the `Authorization` header matches `CRON_SECRET`, which protects the route even if the env var is unset. 【F:src/app/api/cron/fiscal-processor/route.ts†L10-L15】
- Bank and email sync only enforce when `CRON_SECRET` is set; if missing, the routes run unauthenticated. This is a gap versus the requirement that all cron endpoints demand the secret. 【F:src/app/api/cron/bank-sync/route.ts†L8-L15】【F:src/app/api/cron/email-sync/route.ts†L6-L13】

## Idempotency and retry evidence

- **Fiscal request worker**: acquires queued/failed jobs with `FOR UPDATE SKIP LOCKED`, sets worker locks, recovers stale locks, and updates status/next retry with exponential backoff on failures—supporting safe retries and de-duped processing. 【F:src/app/api/cron/fiscal-processor/route.ts†L17-L227】
- **Fiscal request enqueueing**: uses an upsert on `(companyId, invoiceId, messageType)` so re-queueing the same invoice resets status instead of duplicating work. 【F:src/lib/fiscal/should-fiscalize.ts†L39-L75】
- **Bank sync**: deduplicates by provider transaction ID or date/amount/reference match before insert; also flags fuzzy duplicates for review, reducing duplicate creation across reruns. 【F:src/lib/bank-sync/dedup.ts†L49-L184】
- **Email sync attachments**: hashes message+attachment metadata and checks a unique composite `(connectionId, contentHash)` before persisting, making replays idempotent. Cursor checkpoints are updated each batch to resume safely. 【F:src/lib/email-sync/sync-service.ts†L57-L250】

## Logging and failure handling

- Each cron route logs errors to console and returns structured 5xx responses for observability (`[fiscal-processor]`, `[bank-sync]`, `[cron/email-sync]`). 【F:src/app/api/cron/fiscal-processor/route.ts†L59-L65】【F:src/app/api/cron/bank-sync/route.ts†L92-L111】【F:src/app/api/cron/email-sync/route.ts†L31-L37】
- Email sync records the last error on the connection record for operator visibility. 【F:src/lib/email-sync/sync-service.ts†L103-L114】

## Gaps and recommended fixes

1. **Missing mandatory secret on bank/email cron**: If `CRON_SECRET` is unset, the routes run unauthenticated.
   - **Fix**: Require the header match even when the env var is absent by short-circuiting when missing (e.g., return 401 if `!cronSecret` or header mismatch) and add tests for the guard.
2. **Bank sync concurrency idempotency**: Deduplication occurs after fetch, but concurrent runs could still insert duplicates if they race before the duplicate check resolves.
   - **Fix**: add a unique constraint on `(bankAccountId, externalId)` (and/or date+amount+reference) plus a transaction-level upsert, or wrap the sync per account in a DB advisory lock to serialize runs.
3. **Email sync job creation idempotency**: Attachments are deduped, but `importJob` creation relies on the attachment insert; if the insert fails post-upload, a rerun re-uploads before failing again.
   - **Fix**: wrap attachment persist + import job creation in a transaction and reuse `contentHash` to skip re-uploading when the R2 object already exists.
