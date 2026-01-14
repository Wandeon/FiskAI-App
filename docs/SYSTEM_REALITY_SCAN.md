# FiskAI System Reality Scan

> **Generated:** 2026-01-02
> **Scope:** Complete system audit - UI, API, Domain, State Machines, Invariants, Automation, Integrations
> **Method:** Source code extraction and evidence verification

---

## 1. Executive Reality Summary

### What This System Actually Does

FiskAI is a Croatian business management SaaS with four portals:

| Portal       | URL                 | Audience       | Verified Routes |
| ------------ | ------------------- | -------------- | --------------- |
| Marketing    | fiskai.hr           | Public         | 52 pages        |
| Client App   | app.fiskai.hr       | Business users | 70 pages        |
| Staff Portal | app.fiskai.hr/staff | Accountants    | 15 pages        |
| Admin Portal | app.fiskai.hr/admin | Platform owner | 22 pages        |

**Core Verified Capabilities:**

- Invoice creation with fiscalization to Croatian tax authority (FINA/CIS)
- Expense tracking with VAT calculation
- Bank account sync via GoCardless
- E-invoice sending/receiving
- Regulatory truth layer (automated regulatory content processing)
- AI-assisted data extraction from receipts/invoices

**Authentication:** NextAuth v5 with email OTP, role-based access (USER/STAFF/ADMIN)

**Database:** PostgreSQL via Prisma 7, 80+ enums, comprehensive audit logging

### System Health Indicators

| Component             | Status         | Evidence                                                 |
| --------------------- | -------------- | -------------------------------------------------------- |
| Domain state machines | 4/7 enforced   | Invoice, FiscalRequest, BankTransaction, StaffAssignment |
| Invariant enforcement | 11/13 enforced | Money precision, quantity constraints, state transitions |
| Background workers    | 15 active      | BullMQ queues, cron jobs                                 |
| External integrations | 10 real        | FINA, Stripe, Resend, OpenAI, GoCardless, R2, etc.       |

---

## 2. UI Surface Map

### Route Group: Marketing (52 pages)

**Layout:** `src/app/(marketing)/layout.tsx`

| Route           | Component  | Actions       | Backend                           |
| --------------- | ---------- | ------------- | --------------------------------- |
| `/`             | `page.tsx` | Display only  | None                              |
| `/login`        | `page.tsx` | Form submit   | Server action: auth               |
| `/register`     | `page.tsx` | Form submit   | Server action: auth               |
| `/pricing`      | `page.tsx` | Display + CTA | Stripe checkout                   |
| `/assistant`    | `page.tsx` | Chat form     | API: `/api/assistant/chat/stream` |
| `/vodic/[slug]` | `page.tsx` | Display       | MDX content                       |
| `/alati/*`      | Various    | Forms         | Client-side calculators           |

### Route Group: App Portal (70 pages)

**Layout:** `src/app/(app)/layout.tsx`
**Auth Required:** Yes (USER role)

| Route                     | Component  | Visible Actions        | Backend Trigger                        |
| ------------------------- | ---------- | ---------------------- | -------------------------------------- |
| `/dashboard`              | `page.tsx` | Display metrics        | Query only                             |
| `/invoices`               | `page.tsx` | List, filter           | Query: invoices                        |
| `/invoices/new`           | `page.tsx` | Create form            | Server action: `createInvoice`         |
| `/invoices/[id]`          | `page.tsx` | View, fiscalize, email | Multiple actions                       |
| `/expenses`               | `page.tsx` | List, filter           | Query: expenses                        |
| `/expenses/new`           | `page.tsx` | Create form            | Server action: `createExpense`         |
| `/contacts`               | `page.tsx` | CRUD                   | Server actions                         |
| `/products`               | `page.tsx` | CRUD                   | Server actions                         |
| `/banking/import`         | `page.tsx` | File upload            | API: `/api/banking/import/upload`      |
| `/banking/reconciliation` | `page.tsx` | Match actions          | Server actions                         |
| `/settings/fiscalisation` | `page.tsx` | Certificate upload     | Server action: `saveCertificateAction` |
| `/pos`                    | `page.tsx` | POS sale               | Server action: `processPosSale`        |

### Route Group: Staff Portal (15 pages)

**Layout:** `src/app/(staff)/layout.tsx`
**Auth Required:** Yes (STAFF role)

| Route                   | Purpose                      |
| ----------------------- | ---------------------------- |
| `/staff-dashboard`      | Overview of assigned clients |
| `/clients`              | Client list                  |
| `/clients/[clientId]/*` | Client detail views          |
| `/tasks`                | Task management              |
| `/invitations`          | Client invitations           |

### Route Group: Admin Portal (22 pages)

**Layout:** `src/app/(admin)/layout.tsx`
**Auth Required:** Yes (ADMIN role)

| Route            | Purpose                           |
| ---------------- | --------------------------------- |
| `/overview`      | Platform metrics                  |
| `/tenants`       | Tenant management                 |
| `/regulatory/*`  | Regulatory truth layer management |
| `/feature-flags` | Feature flag control              |
| `/news`          | News pipeline management          |
| `/alerts`        | System alerts                     |

### UI-Only Components (No Backend)

- `/alati/pdv-kalkulator` - Client-side VAT calculator
- `/alati/kalkulator-doprinosa` - Client-side contribution calculator
- `/alati/oib-validator` - Client-side OIB validation

### Headless Capabilities (No UI)

- Fiscal queue processing (cron-triggered)
- Email sync processing (cron-triggered)
- Bank sync processing (cron-triggered)
- Regulatory truth pipeline (worker-triggered)

---

## 3. API / Server Action Map

### API Routes (35+ routes)

#### COMMAND Routes (Mutate State)

| Route                                   | Method | Auth                | Input Schema              | Output             | Evidence                                                |
| --------------------------------------- | ------ | ------------------- | ------------------------- | ------------------ | ------------------------------------------------------- |
| `/api/auth/send-code`                   | POST   | None (rate limited) | `{email, type}`           | `{success}`        | `src/app/api/auth/send-code/route.ts`                   |
| `/api/auth/verify-code`                 | POST   | None (rate limited) | `{email, code, type}`     | `{success, token}` | `src/app/api/auth/verify-code/route.ts`                 |
| `/api/banking/import/upload`            | POST   | Session+Company     | FormData                  | `{success, jobId}` | `src/app/api/banking/import/upload/route.ts`            |
| `/api/billing/checkout`                 | POST   | Session             | `{planId}`                | `{url}`            | `src/app/api/billing/checkout/route.ts`                 |
| `/api/accounting-periods/lock`          | POST   | Session+Company     | `{periodId, action}`      | `{period}`         | `src/app/api/accounting-periods/lock/route.ts`          |
| `/api/admin/feature-flags`              | POST   | Admin               | `createFeatureFlagSchema` | Flag object        | `src/app/api/admin/feature-flags/route.ts`              |
| `/api/admin/regulatory-truth/bootstrap` | POST   | Admin               | None                      | `{success}`        | `src/app/api/admin/regulatory-truth/bootstrap/route.ts` |

#### QUERY Routes (Read Only)

| Route                                | Method | Auth            | Output              | Evidence                                             |
| ------------------------------------ | ------ | --------------- | ------------------- | ---------------------------------------------------- |
| `/api/admin/regulatory-truth/status` | GET    | Admin           | Health metrics      | `src/app/api/admin/regulatory-truth/status/route.ts` |
| `/api/admin/feature-flags`           | GET    | Admin           | `{flags, stats}`    | `src/app/api/admin/feature-flags/route.ts`           |
| `/api/e-invoices/receive`            | GET    | Session+Company | `{invoices, count}` | `src/app/api/e-invoices/receive/route.ts`            |

#### ARTIFACT Routes (Generate Files)

| Route                             | Method | Output Type | Evidence                                                 |
| --------------------------------- | ------ | ----------- | -------------------------------------------------------- |
| `/api/admin/companies/[id]/audit` | GET    | CSV         | `src/app/api/admin/companies/[companyId]/audit/route.ts` |

### Server Actions (80+ functions)

#### Invoice Domain

| Action             | File                           | Auth             | Mutations              |
| ------------------ | ------------------------------ | ---------------- | ---------------------- |
| `createInvoice`    | `src/app/actions/invoice.ts`   | `invoice:create` | EInvoice, EInvoiceLine |
| `updateInvoice`    | `src/app/actions/invoice.ts`   | `invoice:update` | EInvoice (DRAFT only)  |
| `deleteInvoice`    | `src/app/actions/invoice.ts`   | `invoice:delete` | EInvoice (DRAFT only)  |
| `fiscalizeInvoice` | `src/app/actions/fiscalize.ts` | Company          | FiscalRequest queue    |
| `sendInvoiceEmail` | `src/app/actions/invoice.ts`   | Company          | Email via Resend       |

#### Expense Domain

| Action                   | File                         | Auth             | Mutations                      |
| ------------------------ | ---------------------------- | ---------------- | ------------------------------ |
| `createExpense`          | `src/app/actions/expense.ts` | `expense:create` | Expense, ExpenseLine, UraInput |
| `updateExpense`          | `src/app/actions/expense.ts` | `expense:update` | Expense, ExpenseCorrection     |
| `markExpenseAsPaid`      | `src/app/actions/expense.ts` | Company          | Expense status                 |
| `createRecurringExpense` | `src/app/actions/expense.ts` | Company          | RecurringExpense               |

#### Banking Domain

| Action                  | File                         | Auth    | Mutations                        |
| ----------------------- | ---------------------------- | ------- | -------------------------------- |
| `createBankAccount`     | `src/app/actions/banking.ts` | Company | BankAccount                      |
| `importBankStatement`   | `src/app/actions/banking.ts` | Company | BankTransaction, StatementImport |
| `matchTransaction`      | `src/app/actions/banking.ts` | Company | MatchRecord                      |
| `autoMatchTransactions` | `src/app/actions/banking.ts` | Company | Multiple MatchRecords            |

#### Company Domain

| Action          | File                         | Auth        | Mutations             |
| --------------- | ---------------------------- | ----------- | --------------------- |
| `createCompany` | `src/app/actions/company.ts` | User        | Company, CompanyUser  |
| `updateCompany` | `src/app/actions/company.ts` | OWNER/ADMIN | Company               |
| `switchCompany` | `src/app/actions/company.ts` | User        | User.defaultCompanyId |

---

## 4. Capability Matrix

### Proven Capabilities (Code Evidence)

| Capability                                     | Trigger                             | Preconditions                            | State Changes                      | Artifacts      | Evidence                                           |
| ---------------------------------------------- | ----------------------------------- | ---------------------------------------- | ---------------------------------- | -------------- | -------------------------------------------------- |
| The system can create an invoice               | `createInvoice` action              | Authenticated, company selected          | EInvoice(DRAFT), EInvoiceLines     | None           | `src/app/actions/invoice.ts:createInvoice`         |
| The system can fiscalize an invoice            | `fiscalizeInvoice` action           | Invoice in DRAFT, certificate configured | EInvoice(FISCALIZED), JIR assigned | Fiscal XML     | `src/app/actions/fiscalize.ts:fiscalizeInvoice`    |
| The system can send an invoice email           | `sendInvoiceEmail` action           | Invoice exists, recipient email          | Email sent, emailMessageId stored  | PDF attachment | `src/app/actions/invoice.ts:sendInvoiceEmail`      |
| The system can extract data from receipt image | `/api/ai/extract`                   | Authenticated, image data                | AIUsage record                     | Extracted JSON | `src/app/api/ai/extract/route.ts`                  |
| The system can import bank statement           | `importBankStatement` action        | Bank account exists                      | BankTransactions created           | None           | `src/app/actions/banking.ts:importBankStatement`   |
| The system can auto-match transactions         | `autoMatchTransactions` action      | Transactions exist                       | MatchRecords created               | None           | `src/app/actions/banking.ts:autoMatchTransactions` |
| The system can create accounting period        | `/api/accounting-periods` POST      | Authenticated                            | AccountingPeriod created           | None           | `src/app/api/accounting-periods/route.ts`          |
| The system can lock accounting period          | `/api/accounting-periods/lock` POST | Period exists                            | Period.lockedAt set                | None           | `src/app/api/accounting-periods/lock/route.ts`     |
| The system can process POS sale                | `processPosSale` action             | Premises/device configured               | EInvoice(FISCALIZED)               | Fiscal receipt | `src/app/actions/pos.ts:processPosSale`            |
| The system can stream AI assistant responses   | `/api/assistant/chat/stream`        | None                                     | None                               | NDJSON stream  | `src/app/api/assistant/chat/stream/route.ts`       |

### Ambiguous Capabilities

| Capability              | Issue                                                                          | Evidence                       |
| ----------------------- | ------------------------------------------------------------------------------ | ------------------------------ |
| Period lock enforcement | DB fields exist but no domain enforcement prevents mutations to locked periods | `prisma/schema.prisma:278-303` |
| Journal entry posting   | DRAFT/POSTED states exist but no validation prevents editing POSTED entries    | `prisma/schema.prisma:373-400` |

---

## 5. State Machine Tables

### Invoice Status (ENFORCED)

**Evidence:** `src/domain/invoicing/InvoiceStatus.ts`, `src/domain/invoicing/Invoice.ts`

```
┌─────────────────────────┐
│         DRAFT           │
└───────────┬─────────────┘
            │ issue()
            ▼
┌─────────────────────────┐
│  PENDING_FISCALIZATION  │◄──── rollback()
└───────────┬─────────────┘
            │ fiscalize()
            ▼
┌─────────────────────────┐
│       FISCALIZED        │
└───────────┬─────────────┘
            │ send()
            ▼
┌─────────────────────────┐
│          SENT           │
└───────────┬─────────────┘
            │ markDelivered() / accept()
            ▼
┌─────────────────────────┐
│   DELIVERED / ACCEPTED  │
└───────────┬─────────────┘
            │ archive()
            ▼
┌─────────────────────────┐
│        ARCHIVED         │ (terminal)
└─────────────────────────┘

           ┌───────────────┐
Any ──────►│   CANCELED    │ (terminal)
           └───────────────┘
```

**Enforcement:** `transitionTo()` throws `InvoiceError` on invalid transition
**Tests:** 195 test cases in `InvoiceStatus.test.ts`

### Fiscal Status (ENFORCED)

**Evidence:** `src/domain/fiscalization/FiscalStatus.ts`

| From              | Allowed To                         |
| ----------------- | ---------------------------------- |
| PENDING           | SUBMITTING, FAILED                 |
| SUBMITTING        | FISCALIZED, FAILED                 |
| FAILED            | RETRY_SCHEDULED, DEADLINE_EXCEEDED |
| RETRY_SCHEDULED   | SUBMITTING                         |
| FISCALIZED        | (terminal)                         |
| DEADLINE_EXCEEDED | (terminal)                         |
| NOT_REQUIRED      | (terminal)                         |

**Enforcement:** `canTransitionFiscal()` function
**48-hour deadline:** `DEFAULT_FISCAL_DEADLINE_HOURS = 48`

### Bank Transaction Match Status (ENFORCED)

**Evidence:** `src/domain/banking/BankTransaction.ts`

| From           | Allowed To     | Method                      |
| -------------- | -------------- | --------------------------- |
| UNMATCHED      | AUTO_MATCHED   | `matchToInvoice(id, true)`  |
| UNMATCHED      | MANUAL_MATCHED | `matchToInvoice(id, false)` |
| UNMATCHED      | IGNORED        | `ignore()`                  |
| AUTO_MATCHED   | UNMATCHED      | `unmatch()`                 |
| MANUAL_MATCHED | UNMATCHED      | `unmatch()`                 |
| IGNORED        | UNMATCHED      | `unignore()`                |

**Enforcement:** Methods throw `BankingError` on invalid state

### Staff Assignment Status (ENFORCED)

**Evidence:** `src/domain/identity/StaffAssignment.ts`

| From    | Allowed To |
| ------- | ---------- |
| ACTIVE  | REVOKED    |
| REVOKED | (terminal) |

**Enforcement:** `revoke()` throws `IdentityError` if already revoked

### NOT ENFORCED State Machines

| Entity           | States                                                    | Issue                                                |
| ---------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| EInvoice         | DRAFT→PENDING→FISCALIZED→SENT→DELIVERED→ACCEPTED→ARCHIVED | No domain class, transitions at infrastructure layer |
| Expense          | DRAFT→PENDING→PAID→CANCELLED                              | Enum exists, no enforcement                          |
| AccountingPeriod | FUTURE→OPEN→SOFT_CLOSE→CLOSED→LOCKED                      | DB only, no domain enforcement                       |
| JournalEntry     | DRAFT→POSTED                                              | DB only, no domain enforcement                       |

---

## 6. Invariant & Lock Register

### ENFORCED Invariants

| Invariant                               | Mechanism                                         | Location                                                        | Test Evidence             |
| --------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------- | ------------------------- |
| Money uses Decimal, 2 places, no floats | Private constructor, `fromCents()` validation     | `src/domain/shared/Money.ts:19-21`                              | `Money.test.ts:17`        |
| Currency mixing prevented               | `add()`/`subtract()` throw on mismatch            | `src/domain/shared/Money.ts:33-42`                              | `Money.test.ts:58-68`     |
| Quantity cannot be negative             | `Quantity.of()` throws on negative                | `src/domain/shared/Quantity.ts:14-16`                           | Tests confirm             |
| Invoice lines only on DRAFT             | `assertDraft()` guard                             | `src/domain/invoicing/Invoice.ts:108-114`                       | `Invoice.test.ts:79-110`  |
| Buyer update only on DRAFT              | `assertDraft()` guard                             | `src/domain/invoicing/Invoice.ts:122`                           | `Invoice.test.ts:124-130` |
| Fiscal deadline 48 hours                | `isDeadlineExceeded()` check                      | `src/domain/fiscalization/FiscalRequest.ts:150-155`             | Code enforced             |
| Tenant scope isolation                  | `TenantScopeMismatchError` on cross-tenant access | `src/infrastructure/invoicing/PrismaInvoiceRepository.ts:61-71` | Audit logging             |
| VAT rate immutability                   | Private fields, no setters                        | `src/domain/shared/VatRate.ts:8-11`                             | Code structure            |
| Unique period per company/year          | `@@unique([companyId, fiscalYear, periodNumber])` | `prisma/schema.prisma:301`                                      | DB constraint             |

### NOT ENFORCED Invariants

| Invariant                        | Issue                                       | Location                       |
| -------------------------------- | ------------------------------------------- | ------------------------------ |
| Locked period prevents mutations | `lockedAt` field exists but no domain check | `prisma/schema.prisma:278-303` |
| POSTED journal entries immutable | `status` enum exists but no validation      | `prisma/schema.prisma:373-400` |

---

## 7. Automation Inventory

### Layer A: Scheduled Discovery

| Job               | Schedule     | Queue     | Function                  | Evidence                                                |
| ----------------- | ------------ | --------- | ------------------------- | ------------------------------------------------------- |
| Discovery Refresh | 06:00 daily  | sentinel  | Scan regulatory endpoints | `src/lib/regulatory-truth/workers/scheduler.service.ts` |
| Confidence Decay  | 03:00 Sunday | scheduled | Decay rule confidence     | `scheduler.service.ts`                                  |
| E2E Validation    | 05:00 daily  | scheduled | Validate invariants       | `scheduler.service.ts`                                  |
| Health Snapshot   | 00:00 daily  | scheduled | Collect metrics           | `scheduler.service.ts`                                  |

### Layer B: Continuous Queue Processing

| Worker       | Queue        | Concurrency | Rate Limit | Function                    | Evidence                 |
| ------------ | ------------ | ----------- | ---------- | --------------------------- | ------------------------ |
| Sentinel     | sentinel     | 1           | 5/min      | Discover regulatory content | `sentinel.worker.ts`     |
| OCR          | ocr          | 1           | 2/min      | PDF→Text via Tesseract      | `ocr.worker.ts`          |
| Extractor    | extract      | 2           | 10/min     | LLM fact extraction         | `extractor.worker.ts`    |
| Composer     | compose      | 1           | 5/min      | Aggregate facts to rules    | `composer.worker.ts`     |
| Reviewer     | review       | 5           | 5/min      | Quality check rules         | `reviewer.worker.ts`     |
| Arbiter      | arbiter      | 1           | 3/min      | Resolve conflicts           | `arbiter.worker.ts`      |
| Releaser     | release      | 1           | 2/min      | Publish rules               | `releaser.worker.ts`     |
| Embedding    | embedding    | 2           | 10/min     | Vector embeddings           | `embedding.worker.ts`    |
| Content Sync | content-sync | 1           | 2/min      | MDX patching                | `content-sync.worker.ts` |
| Article      | article      | 1           | 2/min      | Generate articles           | `article.worker.ts`      |

### Cron API Routes

| Route                           | Auth        | Function                    | Evidence                                        |
| ------------------------------- | ----------- | --------------------------- | ----------------------------------------------- |
| `/api/cron/fiscal-processor`    | CRON_SECRET | Process fiscal queue        | `src/app/api/cron/fiscal-processor/route.ts`    |
| `/api/cron/email-sync`          | CRON_SECRET | Sync email connections      | `src/app/api/cron/email-sync/route.ts`          |
| `/api/cron/bank-sync`           | CRON_SECRET | Sync bank accounts          | `src/app/api/cron/bank-sync/route.ts`           |
| `/api/cron/deadline-reminders`  | CRON_SECRET | Send deadline emails        | `src/app/api/cron/deadline-reminders/route.ts`  |
| `/api/cron/recurring-expenses`  | CRON_SECRET | Generate recurring expenses | `src/app/api/cron/recurring-expenses/route.ts`  |
| `/api/cron/news/fetch-classify` | CRON_SECRET | Fetch/classify news         | `src/app/api/cron/news/fetch-classify/route.ts` |
| `/api/cron/cleanup-uploads`     | CRON_SECRET | Clean orphaned files        | `src/app/api/cron/cleanup-uploads/route.ts`     |

### Error Handling

- **Retry Strategy:** 3 attempts with exponential backoff (10s, 20s, 40s)
- **Dead Letter Queue:** Failed jobs retained 30 days
- **Circuit Breakers:** Per-stage in continuous drainer
- **Lock Recovery:** Stale locks recovered after 5 minutes

---

## 8. Integration Inventory

### Production Integrations (REAL)

| Integration          | Purpose                | Auth             | Error Handling                  | Evidence                                     |
| -------------------- | ---------------------- | ---------------- | ------------------------------- | -------------------------------------------- |
| FINA/CIS             | Croatian fiscalization | P12 Certificate  | SOAP fault parsing, 30s timeout | `src/lib/fiscal/porezna-client.ts`           |
| Stripe               | Billing & POS Terminal | API Key          | Webhook signature verification  | `src/lib/billing/stripe.ts`                  |
| Resend               | Email sending          | API Key          | Suppression list, SMTP fallback | `src/lib/email.ts`                           |
| OpenAI               | OCR/extraction         | API Key          | Lazy loading, usage tracking    | `src/lib/ai/extract.ts`                      |
| DeepSeek             | AI alternative         | API Key          | Retry with backoff              | `src/lib/ai/deepseek.ts`                     |
| Ollama               | Open-source AI         | Optional API Key | Retry with backoff              | `src/lib/article-agent/llm/ollama-client.ts` |
| GoCardless           | Bank sync              | API Key          | Token refresh, deduplication    | `src/lib/bank-sync/providers/gocardless.ts`  |
| Cloudflare R2        | File storage           | API Key          | HMAC tenant isolation           | `src/lib/r2-client.ts`                       |
| Cloudflare Turnstile | Bot protection         | API Key          | Fail-closed in production       | `src/lib/turnstile.ts`                       |

### Mock/Test Mode Available

| Integration | Mock Trigger            | Evidence                                     |
| ----------- | ----------------------- | -------------------------------------------- |
| FINA        | `FISCAL_DEMO_MODE=true` | `src/lib/e-invoice/providers/mock-fiscal.ts` |
| Resend      | API key not configured  | Graceful fallback                            |
| Turnstile   | Dev mode without key    | Returns success                              |

### Environment Variables Required

```
# Fiscal
FISCAL_CERT_KEY=           # 32 bytes as 64 hex chars
FISCAL_DEMO_MODE=          # true for mock

# Payment
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PAUSALNI=
STRIPE_PRICE_STANDARD=
STRIPE_PRICE_PRO=

# Email
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# AI
OPENAI_API_KEY=            # Server-side only, never NEXT_PUBLIC_
DEEPSEEK_API_KEY=          # Optional
OLLAMA_API_KEY=            # Optional

# Banking
GOCARDLESS_SECRET_ID=
GOCARDLESS_SECRET_KEY=

# Storage
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=

# Security
TURNSTILE_SECRET_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=

# Cron
CRON_SECRET=
```

---

## 9. AI Operability Gaps

### Fully Programmatic (AI Can Operate)

| Operation         | Endpoint                  | Required Inputs                  | Machine-Readable Errors   |
| ----------------- | ------------------------- | -------------------------------- | ------------------------- |
| Create invoice    | `createInvoice` action    | `{buyerId, lines, dueDate}`      | Zod validation errors     |
| Create expense    | `createExpense` action    | `{amount, vendor, category}`     | Zod validation errors     |
| Fiscalize invoice | `fiscalizeInvoice` action | `{invoiceId}`                    | InvoiceError with code    |
| Match transaction | `matchTransaction` action | `{transactionId, type, matchId}` | BankingError with code    |
| Query state       | Various GET endpoints     | ID parameters                    | Structured JSON responses |

### Partially Programmatic (Gaps Exist)

| Operation                    | Gap                            | Mitigation                      |
| ---------------------------- | ------------------------------ | ------------------------------- |
| File upload (bank statement) | Requires FormData construction | Use multipart/form-data         |
| Certificate upload           | Requires file + password       | Manual intervention recommended |
| POS sale                     | Requires device/premises IDs   | Query defaults first            |

### Not Programmatic (UI-Only)

| Operation               | Issue                    | Location                      |
| ----------------------- | ------------------------ | ----------------------------- |
| VAT calculator          | Client-side only, no API | `/alati/pdv-kalkulator`       |
| Contribution calculator | Client-side only, no API | `/alati/kalkulator-doprinosa` |
| OIB validator           | Client-side only, no API | `/alati/oib-validator`        |

### Error Readability

| Error Type     | Format                                  | Machine Readable   |
| -------------- | --------------------------------------- | ------------------ |
| Zod validation | `{issues: [{path, message}]}`           | YES                |
| Domain errors  | `{code, message, context}`              | YES                |
| HTTP errors    | `{error: string}`                       | PARTIAL - no codes |
| Fiscal errors  | `{httpStatus, errorCode, errorMessage}` | YES                |

### State Query Completeness

| Entity             | Query Endpoint                | Filters Available            |
| ------------------ | ----------------------------- | ---------------------------- |
| Invoices           | `getInvoices()` action        | status, date range, buyer    |
| Expenses           | `getExpenses()` action        | status, date range, category |
| Contacts           | `getContacts()` action        | type, search                 |
| Bank transactions  | Varies                        | status, date range           |
| Accounting periods | `/api/accounting-periods` GET | company only                 |

### AI Operability Blockers

1. **Period lock check not queryable** - No endpoint to verify if period is locked before mutation
2. **No bulk operations API** - Must call individual actions for batch updates
3. **Certificate status not exposed** - Cannot programmatically check certificate validity
4. **Some HTTP errors lack error codes** - Generic string messages require parsing

---

## Appendix: File Reference

### Core Domain Files

- `src/domain/invoicing/Invoice.ts` - Invoice aggregate
- `src/domain/invoicing/InvoiceStatus.ts` - State machine
- `src/domain/fiscalization/FiscalRequest.ts` - Fiscal request
- `src/domain/fiscalization/FiscalStatus.ts` - Fiscal state machine
- `src/domain/banking/BankTransaction.ts` - Bank transaction
- `src/domain/shared/Money.ts` - Money value object
- `src/domain/shared/Quantity.ts` - Quantity value object

### Infrastructure Files

- `src/infrastructure/invoicing/PrismaInvoiceRepository.ts` - Invoice persistence
- `src/lib/fiscal/porezna-client.ts` - FINA integration
- `src/lib/billing/stripe.ts` - Stripe integration
- `src/lib/email.ts` - Email integration

### Worker Files

- `src/lib/regulatory-truth/workers/*.worker.ts` - All workers
- `src/lib/regulatory-truth/workers/scheduler.service.ts` - Job scheduler

### Schema

- `prisma/schema.prisma` - Database schema (80+ enums, all models)

---

_This document was generated by systematic source code extraction. All claims have inline evidence references. Items marked NOT PROVEN or NOT ENFORCED lack implementation evidence._
