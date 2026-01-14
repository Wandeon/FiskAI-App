# APPENDIX: E-Invoice Inbound Worker Audit

> **Document Type:** Stakeholder-Grade Technical Audit
> **Component:** einvoice-inbound Worker (ePoslovanje Inbound Poller)
> **Layer:** E-Invoice Integration Layer
> **Last Updated:** 2026-01-14
> **Document Version:** 1.0.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Technical Implementation](#2-technical-implementation)
3. [ePoslovanje API Integration](#3-eposlovanje-api-integration)
4. [Polling Mechanism](#4-polling-mechanism)
5. [Inputs](#5-inputs)
6. [Outputs](#6-outputs)
7. [Dependencies](#7-dependencies)
8. [Prerequisites](#8-prerequisites)
9. [Configuration](#9-configuration)
10. [Error Handling](#10-error-handling)
11. [Rate Limiting](#11-rate-limiting)
12. [Security](#12-security)
13. [Monitoring & Observability](#13-monitoring--observability)
14. [Known Issues & Limitations](#14-known-issues--limitations)
15. [Recommended Improvements](#15-recommended-improvements)
16. [Appendix A: Dual-Path Architecture](#appendix-a-dual-path-architecture)
17. [Appendix B: Test Coverage](#appendix-b-test-coverage)

---

## 1. Overview

### 1.1 Purpose

The **E-Invoice Inbound Worker** (einvoice-inbound) is responsible for polling the ePoslovanje B2B e-invoice intermediary for incoming invoices and storing them in the FiskAI database. It enables businesses to automatically receive and track e-invoices from their suppliers without manual intervention.

### 1.2 Role in E-Invoice System

```
E-Invoice Inbound Flow
==================================
[ePoslovanje API] --> [Inbound Poller] --> [eInvoice Table] --> [Business Dashboard]
      |                      |                   |
      |                      v                   v
      |              [ProviderSyncState]   [Contact Auto-Creation]
      |                      |
      v                      v
[Supplier sends]    [Cursor advances on success]
```

The worker operates as a scheduled poller:

1. **Poll Phase:** Queries ePoslovanje API for new incoming invoices
2. **Process Phase:** Creates or links seller contacts by OIB
3. **Store Phase:** Inserts e-invoices into the database with deduplication
4. **Cursor Phase:** Advances the sync cursor on successful processing

### 1.3 Business Value

| Capability                  | Business Impact                                       |
| --------------------------- | ----------------------------------------------------- |
| Automatic invoice reception | Eliminates manual download from ePoslovanje portal    |
| Supplier auto-creation      | Builds contact database from received invoices        |
| Audit trail                 | Complete history of received invoices with timestamps |
| Multi-tenant support        | Per-company polling with isolated data                |

---

## 2. Technical Implementation

### 2.1 Entry Point

**Worker File:** `src/lib/e-invoice/workers/eposlovanje-inbound-poller.worker.ts`

```typescript
// Entry point - standalone worker process
async function main(): Promise<void> {
  logStartup()

  if (!COMPANY_ID) {
    console.error("[eposlovanje-inbound-poller] FATAL: COMPANY_ID not set")
    process.exit(1)
  }

  setupGracefulShutdown()
  await mainLoop()
}
```

### 2.2 Worker State

The worker maintains internal state for monitoring and graceful shutdown:

```typescript
interface WorkerState {
  isRunning: boolean // Currently in poll cycle
  shutdownRequested: boolean // SIGTERM/SIGINT received
  lastPollAt: Date | null // Last successful poll timestamp
  stats: {
    totalPolls: number // Cumulative poll count
    totalFetched: number // Total invoices fetched from API
    totalInserted: number // Total new invoices stored
    totalSkipped: number // Total duplicates skipped
    totalErrors: number // Total processing errors
  }
}
```

### 2.3 Main Loop Architecture

```typescript
async function mainLoop(): Promise<void> {
  state.isRunning = true

  while (!state.shutdownRequested) {
    await runPollCycle() // Execute one poll

    if (!state.shutdownRequested) {
      await sleep(POLL_INTERVAL_MS) // Wait for next poll
    }
  }

  state.isRunning = false
  console.log("[eposlovanje-inbound-poller] Shutdown complete")
}
```

### 2.4 Docker Deployment

**Container Name:** `fiskai-worker-einvoice-inbound`

```yaml
# From docker-compose.workers.yml
worker-einvoice-inbound:
  <<: *worker-common
  container_name: fiskai-worker-einvoice-inbound
  command: ["node", "dist/workers/lib/e-invoice/workers/eposlovanje-inbound-poller.worker.js"]
  environment:
    <<: *worker-env
    EPOSLOVANJE_API_BASE: ${EPOSLOVANJE_API_BASE}
    EPOSLOVANJE_API_KEY: ${EPOSLOVANJE_API_KEY}
    COMPANY_ID: ${EINVOICE_COMPANY_ID}
    POLL_INTERVAL_MS: ${EINVOICE_POLL_INTERVAL_MS:-300000}
    MAX_WINDOW_DAYS: ${EINVOICE_MAX_WINDOW_DAYS:-7}
    WORKER_TYPE: einvoice-inbound
  deploy:
    resources:
      limits:
        memory: 256M
```

---

## 3. ePoslovanje API Integration

### 3.1 Provider Overview

**Provider:** ePoslovanje.hr (Croatian e-invoice intermediary)
**API Version:** v2 (v1 deprecated as of 2026-01-01)
**Documentation:** https://doc.eposlovanje.hr

### 3.2 API Endpoints Used

| Endpoint                    | Method | Purpose                        |
| --------------------------- | ------ | ------------------------------ |
| `/api/v2/ping`              | GET    | Connection test / health check |
| `/api/v2/document/incoming` | GET    | Fetch incoming invoices        |

### 3.3 Authentication

```typescript
// Authorization header format
headers: {
  Authorization: apiKey,  // Raw API key, not Bearer token
  Accept: "application/json",
}
```

### 3.4 Incoming Invoices Request

```typescript
// Query parameters for incoming invoices
const params = new URLSearchParams()
params.set("fromDate", effectiveFrom.toISOString().split("T")[0])  // YYYY-MM-DD
params.set("toDate", toDate.toISOString().split("T")[0])           // YYYY-MM-DD
params.set("page", page.toString())
params.set("pageSize", pageSize.toString())

// Full URL
GET /api/v2/document/incoming?fromDate=2026-01-01&toDate=2026-01-14&page=1&pageSize=100
```

### 3.5 Response Mapping

The provider maps various field naming conventions to a normalized `IncomingInvoice` structure:

```typescript
interface IncomingInvoice {
  providerRef: string // documentId | messageId | id
  sellerOib: string // sellerOib | senderOib | supplierOib
  sellerName: string // sellerName | senderName | supplierName
  invoiceNumber: string // invoiceNumber | documentNumber | number
  issueDate: Date // issueDate | documentDate | date
  totalAmount: number // totalAmount | amount | total
  currency: string // currency | documentCurrency (default: EUR)
  ublXml: string // ublXml | document (UBL XML content)
}
```

---

## 4. Polling Mechanism

### 4.1 Dual-Path Orchestrator

The worker uses a dual-path orchestrator that routes between V1 (legacy) and V2 (IntegrationAccount) paths:

```
                    pollInbound(companyId)
                           |
                           v
              [Check USE_INTEGRATION_ACCOUNT_INBOUND]
                           |
          +----------------+----------------+
          |                                 |
          v                                 v
    [Flag Disabled]                  [Flag Enabled]
          |                                 |
          v                                 v
    pollInboundV1()              findIntegrationAccount()
    (uses env vars)                         |
                                  +---------+---------+
                                  |                   |
                                  v                   v
                           [Found]             [Not Found]
                                  |                   |
                                  v                   v
                      pollInboundForAccount()   pollInboundV1()
                      (uses IntegrationAccount) (fallback)
```

### 4.2 Sync State Management

The worker maintains cursor state per company/provider/direction:

```typescript
// Database record: ProviderSyncState
{
  companyId: string,
  provider: "eposlovanje",
  direction: "INBOUND",
  lastSuccessfulPollAt: Date,  // Cursor position
  integrationAccountId?: string  // V2 path link
}
```

### 4.3 Polling Window

```typescript
// Window calculation
const fromDate = syncState.lastSuccessfulPollAt
const toDate = new Date()

// Safety cap: never look back more than MAX_WINDOW_DAYS
const maxFrom = new Date()
maxFrom.setDate(maxFrom.getDate() - MAX_WINDOW_DAYS)
const effectiveFrom = fromDate < maxFrom ? maxFrom : fromDate
```

### 4.4 Pagination Strategy

```typescript
let page = 1
const pageSize = 100
let hasMore = true

while (hasMore) {
  const invoices = await provider.fetchIncomingInvoices({
    fromDate: effectiveFrom,
    toDate,
    page,
    pageSize,
  })

  result.fetched += invoices.length
  hasMore = invoices.length >= pageSize // If full page, assume more
  page++

  // Process invoices...

  if (hasMore) {
    await sleep(1000) // Rate limit protection between pages
  }
}
```

---

## 5. Inputs

### 5.1 Environment Variables

| Variable                          | Required | Default | Description                                        |
| --------------------------------- | -------- | ------- | -------------------------------------------------- |
| `COMPANY_ID`                      | Yes      | -       | Company ID to poll for (FATAL if missing)          |
| `DATABASE_URL`                    | Yes      | -       | PostgreSQL connection string                       |
| `EPOSLOVANJE_API_BASE`            | V1 path  | -       | API base URL (e.g., https://eracun.eposlovanje.hr) |
| `EPOSLOVANJE_API_KEY`             | V1 path  | -       | API key for authorization                          |
| `USE_INTEGRATION_ACCOUNT_INBOUND` | No       | false   | Enable V2 path with IntegrationAccount             |
| `POLL_INTERVAL_MS`                | No       | 300000  | Poll interval in milliseconds (5 minutes)          |
| `MAX_WINDOW_DAYS`                 | No       | 7       | Maximum lookback window in days                    |

### 5.2 API Response (IncomingInvoice)

```typescript
// Sample API response mapped to IncomingInvoice
{
  providerRef: "EPO-2026-001234",
  sellerOib: "12345678901",
  sellerName: "Supplier d.o.o.",
  invoiceNumber: "R-001/2026",
  issueDate: "2026-01-14T00:00:00Z",
  totalAmount: 1250.00,
  currency: "EUR",
  ublXml: "<?xml version=\"1.0\"?>..."  // Full UBL XML
}
```

### 5.3 Polling Triggers

The worker runs continuously with these triggers:

| Trigger        | Description                                                   |
| -------------- | ------------------------------------------------------------- |
| Startup        | First poll immediately on worker start                        |
| Interval       | Subsequent polls every `POLL_INTERVAL_MS` (default 5 minutes) |
| Manual restart | Docker restart triggers immediate poll                        |

---

## 6. Outputs

### 6.1 eInvoice Database Records

```typescript
// Created in db.eInvoice table
{
  companyId: string,           // From COMPANY_ID env
  direction: "INBOUND",        // Always INBOUND for this worker
  type: "E_INVOICE",
  invoiceNumber: string,       // From API
  issueDate: Date,             // From API
  currency: string,            // From API (default EUR)
  netAmount: Decimal(0),       // Placeholder (parsed later)
  vatAmount: Decimal(0),       // Placeholder (parsed later)
  totalAmount: Decimal,        // From API
  status: "DELIVERED",         // Initial status
  providerRef: string,         // From API (used for deduplication)
  providerStatus: "RECEIVED",
  ublXml: string | null,       // Full UBL XML if provided
  sellerId: string | null,     // Auto-linked contact
  integrationAccountId?: string,  // V2 path only
  notes: string,               // Includes timestamp and path indicator
}
```

### 6.2 Contact Auto-Creation

When a seller OIB is provided, the worker:

1. Searches for existing contact with matching OIB
2. If not found, creates a new SUPPLIER contact:

```typescript
{
  companyId: string,
  type: "SUPPLIER",
  name: sellerName || `Supplier ${sellerOib}`,
  oib: sellerOib,
}
```

### 6.3 Poll Result Summary

```typescript
interface PollResult {
  companyId: string
  success: boolean // true if no fatal errors
  fetched: number // Invoices retrieved from API
  inserted: number // New invoices stored
  skipped: number // Duplicates (P2002 errors)
  errors: number // Processing errors
  errorMessages: string[] // Error details
}
```

### 6.4 Console Output

```
[eposlovanje-inbound-poller] Poll #1 (V1): fetched=5 inserted=3 skipped=2 errors=0 duration=1234ms
```

---

## 7. Dependencies

### 7.1 External Dependencies

| Dependency      | Type     | Purpose                           |
| --------------- | -------- | --------------------------------- |
| ePoslovanje API | HTTP API | Source of incoming invoices       |
| PostgreSQL      | Database | Storage for invoices and contacts |

### 7.2 Internal Dependencies

| Module                        | Path                                | Purpose                               |
| ----------------------------- | ----------------------------------- | ------------------------------------- |
| `db`                          | `@/lib/db`                          | Prisma client for database operations |
| `logger`                      | `@/lib/logger`                      | Structured logging (pino)             |
| `pollInbound`                 | `../poll-inbound`                   | Dual-path orchestrator                |
| `EposlovanjeEInvoiceProvider` | `../providers/eposlovanje-einvoice` | API client implementation             |
| `findIntegrationAccount`      | `@/lib/integration`                 | V2 path credential lookup             |

### 7.3 Dependency Graph

```
eposlovanje-inbound-poller.worker.ts
    |
    +-- poll-inbound.ts (orchestrator)
    |       |
    |       +-- poll-inbound-v2.ts (IntegrationAccount path)
    |       |       |
    |       |       +-- @/lib/integration/repository
    |       |       +-- @/lib/integration/types
    |       |
    |       +-- providers/eposlovanje-einvoice.ts (API client)
    |
    +-- @/lib/db (Prisma)
    +-- @/lib/logger (Pino)
```

---

## 8. Prerequisites

### 8.1 Required Configuration

1. **COMPANY_ID must be set** - Worker exits with code 1 if missing
2. **Company must exist in database** - Verified at startup
3. **Either V1 or V2 credentials must be available:**
   - V1: `EPOSLOVANJE_API_BASE` + `EPOSLOVANJE_API_KEY` env vars
   - V2: `USE_INTEGRATION_ACCOUNT_INBOUND=true` + IntegrationAccount in database

### 8.2 Database Prerequisites

| Table                | Requirement                  |
| -------------------- | ---------------------------- |
| `Company`            | Target company must exist    |
| `ProviderSyncState`  | Auto-created on first poll   |
| `Contact`            | Auto-created for new sellers |
| `eInvoice`           | Target table for inserts     |
| `IntegrationAccount` | Required for V2 path         |

### 8.3 Network Prerequisites

- Access to ePoslovanje API endpoint
- Access to PostgreSQL database

---

## 9. Configuration

### 9.1 Environment Variable Reference

```bash
# Required
COMPANY_ID=cmp_abc123xyz              # Company to poll for
DATABASE_URL=postgresql://...          # Database connection

# V1 Path (Legacy)
EPOSLOVANJE_API_BASE=https://eracun.eposlovanje.hr
EPOSLOVANJE_API_KEY=your-api-key-here

# V2 Path (IntegrationAccount)
USE_INTEGRATION_ACCOUNT_INBOUND=true   # Enable V2 path

# Optional Tuning
POLL_INTERVAL_MS=300000                # 5 minutes (default)
MAX_WINDOW_DAYS=7                      # 7 days (default)

# Standard Worker Config
NODE_ENV=production
COMMIT_SHA=abc123                      # For startup logging
```

### 9.2 Docker Compose Mapping

```yaml
environment:
  COMPANY_ID: ${EINVOICE_COMPANY_ID} # Maps to COMPANY_ID
  POLL_INTERVAL_MS: ${EINVOICE_POLL_INTERVAL_MS:-300000}
  MAX_WINDOW_DAYS: ${EINVOICE_MAX_WINDOW_DAYS:-7}
  EPOSLOVANJE_API_BASE: ${EPOSLOVANJE_API_BASE}
  EPOSLOVANJE_API_KEY: ${EPOSLOVANJE_API_KEY}
```

### 9.3 Resource Limits

```yaml
deploy:
  resources:
    limits:
      memory: 256M # Low memory footprint
```

---

## 10. Error Handling

### 10.1 Fatal Errors (Exit)

| Condition                     | Exit Code | Recovery                 |
| ----------------------------- | --------- | ------------------------ |
| `COMPANY_ID` not set          | 1         | Set environment variable |
| Company not found in database | 1         | Create company or fix ID |
| Uncaught exception            | 1         | Container restart        |
| Unhandled rejection           | 1         | Container restart        |

### 10.2 Recoverable Errors (Continue)

| Error Type                      | Handling                      | Impact                                |
| ------------------------------- | ----------------------------- | ------------------------------------- |
| API connectivity failure        | Log error, continue           | Poll cycle fails, retry next interval |
| P2002 (duplicate)               | Increment `skipped`, continue | Invoice already exists                |
| Single invoice processing error | Increment `errors`, continue  | Other invoices still processed        |
| Network timeout                 | Caught as temporary failure   | Retry next poll                       |

### 10.3 Error Classification

```typescript
// Duplicate detection (idempotency)
if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
  result.skipped++ // Not counted as error
  logger.debug({ providerRef }, "Skipped duplicate invoice")
}

// Actual errors
else {
  result.errors++
  result.errorMessages.push(`${invoice.providerRef}: ${msg}`)
  logger.error({ providerRef, error: msg }, "Failed to insert inbound invoice")
}
```

### 10.4 Success Criteria

The poll is considered successful if:

```typescript
if (result.errors === 0 || result.inserted > 0 || result.skipped > 0) {
  // Advance cursor
  await db.providerSyncState.update({
    where: { id: syncState.id },
    data: { lastSuccessfulPollAt: toDate },
  })
  result.success = true
}
```

---

## 11. Rate Limiting

### 11.1 API Rate Limiting

| Mechanism        | Value            | Purpose               |
| ---------------- | ---------------- | --------------------- |
| Page size        | 100              | Reasonable batch size |
| Inter-page delay | 1000ms           | Prevent API overwhelm |
| Poll interval    | 300000ms (5 min) | Spread load over time |

### 11.2 Rate Limit Response Handling

The ePoslovanje provider maps HTTP 429 to `PROVIDER_RATE_LIMIT`:

```typescript
case 429:
  return { status: "PROVIDER_RATE_LIMIT", retryable: true }
```

### 11.3 Pagination Rate Control

```typescript
// Between pages
if (hasMore) {
  await new Promise((resolve) => setTimeout(resolve, 1000)) // 1 second delay
}
```

---

## 12. Security

### 12.1 API Key Handling

| Concern          | Implementation                                                 |
| ---------------- | -------------------------------------------------------------- |
| Key storage      | Environment variable (V1) or encrypted IntegrationAccount (V2) |
| Key in logs      | **NEVER logged** - explicit exclusion                          |
| Key in memory    | Only in provider instance                                      |
| Key transmission | HTTPS only, Authorization header                               |

### 12.2 UBL XML Handling

| Concern          | Implementation                        |
| ---------------- | ------------------------------------- |
| UBL in logs      | **NEVER logged** - explicit exclusion |
| UBL storage      | Stored in `eInvoice.ublXml` column    |
| UBL transmission | HTTPS only                            |

### 12.3 Tenant Isolation

**V2 Path (IntegrationAccount):**

```typescript
// HARD TENANT ASSERTION - fails immediately, no retry
if (account.companyId !== companyId) {
  throw new TenantViolationError(companyId, account.companyId, integrationAccountId)
}
```

**V1 Path:**

- Single-tenant by design (one COMPANY_ID per worker instance)
- No cross-tenant risk within single worker

### 12.4 Data Classification

| Data Type      | Classification | Handling                   |
| -------------- | -------------- | -------------------------- |
| API Key        | SECRET         | Never log, env var only    |
| UBL XML        | CONFIDENTIAL   | Store only, never log      |
| OIB            | PII            | Logged for linkage, stored |
| Invoice Number | BUSINESS       | Logged, stored             |
| Company ID     | INTERNAL       | Logged, stored             |

### 12.5 Security Logging

```typescript
// Safe log context (no secrets)
logger.info(
  {
    companyId: COMPANY_ID,
    companyName: company.name,
    path,
    integrationAccountId: isV2Result(result) ? result.integrationAccountId : undefined,
    success: result.success,
    fetched: result.fetched,
    inserted: result.inserted,
    skipped: result.skipped,
    errors: result.errors,
    durationMs: duration,
    // NO apiKey, NO ublXml
  },
  "Inbound poll cycle completed"
)
```

---

## 13. Monitoring & Observability

### 13.1 Startup Banner

```
===============================================
 WORKER STARTUP: eposlovanje-inbound-poller
===============================================
 Company ID:      cmp_abc123xyz
 Poll Interval:   300s
 Max Window:      7 days
 Commit SHA:      abc123def
 Node Env:        production
 Started At:      2026-01-14T10:00:00.000Z
===============================================
```

### 13.2 Per-Poll Metrics

| Metric       | Description                 |
| ------------ | --------------------------- |
| `fetched`    | Invoices retrieved from API |
| `inserted`   | New invoices created        |
| `skipped`    | Duplicates (idempotent)     |
| `errors`     | Processing failures         |
| `durationMs` | Poll cycle duration         |
| `totalPolls` | Cumulative poll count       |

### 13.3 Log Events

| Event                                 | Level | When                |
| ------------------------------------- | ----- | ------------------- |
| `Starting inbound poll orchestration` | INFO  | Poll start          |
| `Inbound poll cycle completed`        | INFO  | Poll end            |
| `Inserted inbound invoice`            | INFO  | Each insert         |
| `Skipped duplicate invoice`           | DEBUG | Each duplicate      |
| `Fatal error during poll cycle`       | ERROR | Unrecoverable error |
| `Some errors occurred during poll`    | WARN  | Partial failure     |

### 13.4 Health Indicators

| Indicator         | Healthy | Unhealthy             |
| ----------------- | ------- | --------------------- |
| Poll success rate | > 95%   | < 50%                 |
| Errors per poll   | 0       | > 5                   |
| Skipped ratio     | < 50%   | > 90% (stale cursor?) |
| Duration          | < 30s   | > 120s                |

---

## 14. Known Issues & Limitations

### 14.1 Current Issues

#### CRITICAL: Crash-Looping Due to Missing COMPANY_ID

**Status:** Active issue in production
**Impact:** Worker restarts continuously
**Root Cause:** `EINVOICE_COMPANY_ID` not set in production environment

```typescript
// From main()
if (!COMPANY_ID) {
  console.error("[eposlovanje-inbound-poller] FATAL: COMPANY_ID not set")
  process.exit(1) // Container restarts, loops
}
```

**Resolution:**

1. Set `EINVOICE_COMPANY_ID` environment variable in production
2. Ensure company exists in database before starting worker

### 14.2 Architectural Limitations

| Limitation           | Impact                              | Mitigation                                        |
| -------------------- | ----------------------------------- | ------------------------------------------------- |
| Single-tenant worker | One worker per company              | Deploy multiple workers with different COMPANY_ID |
| No BullMQ queue      | No job visibility, no retry control | Manual restart for recovery                       |
| Fixed poll interval  | No adaptive polling                 | Configure via env var                             |
| No webhook support   | Polling only, not real-time         | ePoslovanje limitation                            |

### 14.3 API Limitations

| Limitation             | Impact                               | Workaround                   |
| ---------------------- | ------------------------------------ | ---------------------------- |
| 7-day max window       | Cannot backfill older invoices       | Manual import for historical |
| No change notification | Must poll repeatedly                 | Reasonable poll interval     |
| Pagination required    | Multiple API calls for large batches | Built-in pagination loop     |

### 14.4 Data Limitations

| Limitation       | Description                                     |
| ---------------- | ----------------------------------------------- |
| Net/VAT amounts  | Stored as 0, need UBL parsing for actual values |
| Partial UBL      | Some providers may not include full UBL         |
| Contact matching | OIB-only, no fuzzy name matching                |

---

## 15. Recommended Improvements

### 15.1 Immediate Fixes (P0)

1. **Set EINVOICE_COMPANY_ID in production**
   - Add to Coolify environment variables
   - Verify company exists before deploying

2. **Add startup validation with graceful degradation**
   ```typescript
   if (!COMPANY_ID) {
     logger.error({}, "COMPANY_ID not set - worker will sleep and retry")
     await sleep(60000) // Wait 1 minute before exit
     process.exit(1)
   }
   ```

### 15.2 Short-Term Improvements

1. **Migrate to BullMQ architecture**
   - Enable job visibility in dashboard
   - Support retry policies
   - Enable pause/resume

2. **Add health check endpoint**

   ```typescript
   // HTTP health check
   GET /health
   {
     "status": "healthy",
     "lastPollAt": "2026-01-14T10:00:00Z",
     "totalPolls": 100,
     "consecutiveFailures": 0
   }
   ```

3. **Implement UBL parsing**
   - Extract actual net/VAT amounts
   - Parse line items
   - Extract payment terms

### 15.3 Medium-Term Improvements

1. **Multi-tenant worker**
   - Single worker process for all companies
   - Round-robin or priority-based polling
   - Shared rate limiting

2. **Adaptive polling**
   - Increase frequency when invoices detected
   - Decrease frequency during quiet periods
   - Exponential backoff on repeated failures

3. **Duplicate detection enhancement**
   - Hash-based deduplication beyond providerRef
   - Handle invoice updates/corrections

### 15.4 Long-Term Vision

1. **Webhook integration**
   - If ePoslovanje adds webhook support
   - Real-time invoice notification
   - Fallback to polling

2. **Multi-provider support**
   - Support FINA, IE-Racuni providers
   - Unified polling interface
   - Provider-specific adapters

---

## Appendix A: Dual-Path Architecture

### A.1 V1 Path (Legacy)

**Configuration:**

- `EPOSLOVANJE_API_BASE` - API base URL
- `EPOSLOVANJE_API_KEY` - API key

**Flow:**

```
pollInboundV1(companyId)
    |
    +-- assertLegacyPathAllowed()  // Enforcement check
    |
    +-- EposlovanjeEInvoiceProvider(env vars)
    |
    +-- testConnection()
    |
    +-- getOrCreateSyncStateV1(companyId)
    |
    +-- fetchIncomingInvoices() (paginated)
    |
    +-- db.eInvoice.create() per invoice
    |
    +-- updateSyncState()
```

### A.2 V2 Path (IntegrationAccount)

**Configuration:**

- `USE_INTEGRATION_ACCOUNT_INBOUND=true`
- IntegrationAccount in database with kind `EINVOICE_EPOSLOVANJE`

**Flow:**

```
pollInboundForAccount(integrationAccountId, companyId)
    |
    +-- findIntegrationAccountById()
    |
    +-- TENANT ASSERTION (companyId match)
    |
    +-- STATUS ASSERTION (ACTIVE)
    |
    +-- parseEInvoiceSecrets(account.secrets)
    |
    +-- EposlovanjeEInvoiceProvider(decrypted credentials)
    |
    +-- testConnection()
    |
    +-- getOrCreateSyncState(with integrationAccountId)
    |
    +-- fetchIncomingInvoices() (paginated)
    |
    +-- db.eInvoice.create() per invoice (with integrationAccountId)
    |
    +-- touchIntegrationAccount() (update lastUsedAt)
```

### A.3 Migration Strategy

| Phase                   | Description                    | Feature Flag                           |
| ----------------------- | ------------------------------ | -------------------------------------- |
| 1. Both paths available | V1 default, V2 opt-in          | `USE_INTEGRATION_ACCOUNT_INBOUND=true` |
| 2. Shadow mode          | V1 logs "would block" warnings | `FF_LOG_LEGACY_PATH_USAGE=true`        |
| 3. Enforcement          | V1 path throws error           | `FF_ENFORCE_INTEGRATION_ACCOUNT=true`  |
| 4. V1 removal           | Legacy code deleted            | N/A                                    |

---

## Appendix B: Test Coverage

### B.1 Test File

**Location:** `src/lib/e-invoice/workers/__tests__/eposlovanje-inbound-poller.test.ts`

### B.2 Test Categories

| Category                     | Tests | Purpose                       |
| ---------------------------- | ----- | ----------------------------- |
| Cursor Persistence Logic     | 4     | Sync state create/read/update |
| Idempotency Handling         | 4     | P2002 duplicate handling      |
| Security - No Secret Logging | 3     | API key/UBL never logged      |
| Seller Contact Handling      | 2     | Contact find/create           |
| Provider Configuration       | 3     | Config validation             |
| Polling Window Logic         | 2     | Window calculation            |
| Rate Limiting                | 1     | Pagination behavior           |

### B.3 Key Test Assertions

```typescript
// Security: API key never logged
expect(logString).not.toContain(apiKey)
expect(logString).not.toContain("EPOSLOVANJE_API_KEY")

// Security: UBL never logged
expect(logString).not.toContain("SECRET-INVOICE")
expect(logString).not.toContain("ublXml")

// Idempotency: P2002 counted as skipped, not error
expect(result.skipped).toBe(2)
expect(result.errors).toBe(0)

// Window: Capped to MAX_WINDOW_DAYS
expect(effectiveFrom).toEqual(maxFrom)
```

### B.4 Mock Configuration

All tests use mocked dependencies:

- `@/lib/db` - Mocked Prisma client
- `@/lib/logger` - Captured log messages
- `EposlovanjeEInvoiceProvider` - Mocked API client

---

## Document Control

| Version | Date       | Author       | Changes                   |
| ------- | ---------- | ------------ | ------------------------- |
| 1.0.0   | 2026-01-14 | FiskAI Audit | Initial stakeholder audit |

---

_This document is part of the FiskAI Product Bible. For related documentation, see:_

- [06-INTEGRATIONS.md](./06-INTEGRATIONS.md) - Integration overview
- [07-DATA-API.md](./07-DATA-API.md) - API specifications
- [08-APPENDIXES.md](./08-APPENDIXES.md) - Worker appendix index
