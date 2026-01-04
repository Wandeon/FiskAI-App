# Fiscalization Audit (INV-006 & INV-007) — ZKI & JIR

## Pipeline trace (invoice → fiscal request → JIR persistence)

1. **Invoice issued & sent** – `sendEInvoice` generates UBL XML, transmits via provider, stores provider ref/JIR/ZKI if returned, then evaluates whether fiscalization is required.【F:src/app/actions/e-invoice.ts†L151-L215】
2. **Fiscalization decision** – `shouldFiscalizeInvoice` checks company enablement, payment method, existing JIR, pending requests, and active certificate; it queues nothing if already fiscalized (immutability/idempotency guard).【F:src/lib/fiscal/should-fiscalize.ts†L15-L91】
3. **Queueing** – `queueFiscalRequest` upserts a `FiscalRequest` record (unique per invoice/message type) with attempt counters and retry schedule.【F:src/lib/fiscal/should-fiscalize.ts†L94-L131】【F:prisma/schema.prisma†L1033-L1053】
4. **Cron worker pickup** – `/api/cron/fiscal-processor` locks batches with `FOR UPDATE SKIP LOCKED`, recovers stale locks, and processes each job via `executeFiscalRequest` for RACUN/STORNO flows.【F:src/app/api/cron/fiscal-processor/route.ts†L10-L131】【F:src/lib/fiscal/fiscal-pipeline.ts†L19-L128】
5. **Request construction** – `executeFiscalRequest` decrypts certificate, loads invoice+company, builds fiscal invoice, and generates XML; ZKI and raw request XML are persisted on the `FiscalRequest` before signing/submission.【F:src/lib/fiscal/fiscal-pipeline.ts†L22-L107】
6. **Signing & submission** – XML is signed and sent to Porezna; signed XML and response XML are stored on the same request record.【F:src/lib/fiscal/fiscal-pipeline.ts†L91-L107】
7. **Response handling** – Success writes JIR (and ZKI echo) to `FiscalRequest`; invoice updated with JIR/ZKI/fiscalizedAt/fiscalStatus=COMPLETED. Failures classify and persist error metadata plus retry schedule and invoice status (PENDING/FAILED).【F:src/app/api/cron/fiscal-processor/route.ts†L72-L132】

## ZKI computation and storage evidence

- **Algorithm & inputs** – `calculateZKI` concatenates OIB, formatted issue datetime, invoice number, premises code, device code, and total amount (cents, comma decimal). With a private key it RSA-SHA256 signs then MD5 hashes; without, SHA256 hash truncated to 32 hex chars.【F:src/lib/e-invoice/zki.ts†L33-L55】【F:src/lib/e-invoice/zki.ts†L78-L83】
- **Pipeline usage** – XML builder multiplies totals by 100 (cents), feeds company OIB, issue date, invoice number, premises/device codes into `calculateZKI`, then embeds resulting ZKI in the RACUN XML.【F:src/lib/fiscal/xml-builder.ts†L50-L137】
- **Persistence** – ZKI from build step stored on `FiscalRequest` (`zki` field) alongside request/signed/response XML; also copied to invoice on successful response.【F:src/lib/fiscal/fiscal-pipeline.ts†L83-L120】【F:src/app/api/cron/fiscal-processor/route.ts†L75-L99】【F:prisma/schema.prisma†L1033-L1053】

## Immutability and update restrictions after JIR

- **Pre-send guard** – Manual fiscalization refuses if invoice already has JIR/status FISCALIZED.【F:src/app/actions/fiscalize.ts†L36-L43】
- **Automation guard** – `shouldFiscalizeInvoice` halts queueing when `invoice.jir` is present (prevents duplicate requests once fiscalized).【F:src/lib/fiscal/should-fiscalize.ts†L35-L38】
- **Draft-only edits** – `updateInvoice` only allows modifications when status is `DRAFT`, blocking changes to sent/fiscalized invoices (post-JIR immutability).【F:src/app/actions/invoice.ts†L193-L257】
- **Queue guard** – Manual queue action also rejects invoices with an existing JIR.【F:src/app/actions/fiscal-certificate.ts†L261-L292】
- **Observation** – No explicit database constraint prevents direct DB edits after JIR; protection relies on application-layer status checks. Consider adding DB-level immutability (trigger or row-level policy) for stronger enforcement. _(Gap)_

## Retry and idempotency handling

- **Request uniqueness** – Unique index on `(companyId, invoiceId, messageType)` ensures a single queued request per invoice/type, supporting idempotent retries.【F:prisma/schema.prisma†L1033-L1053】
- **Retry classification** – Errors are classified as network/HTTP/porezna codes with retriable flag; retriable ones move to FAILED with `nextRetryAt`, non-retriable to DEAD and invoice fiscalStatus=FAILED.【F:src/app/api/cron/fiscal-processor/route.ts†L101-L197】
- **Backoff & locks** – Exponential backoff (30s → 2h capped with jitter) and stale-lock recovery prevent duplicate processing; worker uses SKIP LOCKED to avoid contention.【F:src/app/api/cron/fiscal-processor/route.ts†L17-L59】【F:src/app/api/cron/fiscal-processor/route.ts†L200-L227】

## Findings and fixes

- **Strengths**: Traceable storage of request/signed/response XML and ZKI/JIR on `FiscalRequest`; deterministic ZKI input formation; queue idempotency with unique key; retry/backoff with lock recovery; application guards block re-fiscalization after JIR.
- **Gaps/Recommendations**:
  - Add database-level immutability (e.g., trigger or constraint) to block invoice updates once `jir` is set, covering out-of-band writes.
  - Ensure production pipeline passes real certificate private key into ZKI calculation everywhere (demo SHA256 mode used in some actions like `fiscalizeInvoice`).
