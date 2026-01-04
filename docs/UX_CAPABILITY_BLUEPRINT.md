# UX & Capability Target Blueprint

> **Version:** 1.0
> **Date:** 2026-01-02
> **Source:** docs/SYSTEM_REALITY_SCAN.md
> **Status:** Authoritative contract for UI redesign

---

## 1. Executive Target Summary

This document defines the authoritative contract between backend, UI, and AI agents for the FiskAI platform redesign.

### Governing Principles

| Principle            | Meaning                                                                              |
| -------------------- | ------------------------------------------------------------------------------------ |
| Zero Redundant Input | If data exists internally or externally, UI must not ask for it                      |
| No Fake Completeness | Every capability is AVAILABLE, BLOCKED (with reason), or NOT IMPLEMENTED             |
| AI-First Operability | Every capability callable by AI without UI scraping                                  |
| UI Is Projection     | UI displays state, explains blockers, collects intent, confirms irreversible actions |

### System Boundaries

| Role             | Portal | Subdomain       | Capabilities Accessible            |
| ---------------- | ------ | --------------- | ---------------------------------- |
| Client/User      | App    | app.fiskai.hr   | 35 capabilities                    |
| Accountant/Staff | Staff  | staff.fiskai.hr | 12 capabilities + client oversight |
| Admin            | Admin  | admin.fiskai.hr | 18 capabilities + platform control |

### Capability Status Summary

| Domain             | AVAILABLE | BLOCKED (fixable)         | NOT IMPLEMENTED |
| ------------------ | --------- | ------------------------- | --------------- |
| Invoicing          | 8         | 0                         | 0               |
| Expenses           | 6         | 0                         | 0               |
| Banking            | 7         | 0                         | 0               |
| Fiscalization      | 3         | 1 (certificate required)  | 0               |
| Contacts           | 5         | 0                         | 0               |
| Products           | 5         | 0                         | 0               |
| Accounting Periods | 3         | 1 (lock enforcement weak) | 0               |
| AI Assistant       | 2         | 0                         | 0               |
| Company Management | 4         | 0                         | 0               |
| Staff Operations   | 4         | 0                         | 0               |
| Admin Operations   | 8         | 0                         | 0               |

---

## 2. Capability Table

### Invoicing Domain

| ID      | Capability         | Roles | Preconditions                                          | Auto-Resolved Inputs                                                                          | Required Intent                                  | State Changes                                 | Artifacts      | Failure Modes                                     |
| ------- | ------------------ | ----- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------- | -------------- | ------------------------------------------------- |
| INV-001 | Create invoice     | USER  | Company selected                                       | `companyId`, `userId`, `invoiceNumber` (auto-increment), `createdAt`, VAT rates from products | `buyerId`, `lines[]`, `dueDate`, `paymentMethod` | EInvoice(DRAFT), EInvoiceLines created        | None           | `VALIDATION_ERROR`, `BUYER_NOT_FOUND`             |
| INV-002 | Update invoice     | USER  | Invoice.status = DRAFT                                 | `invoiceId` from context                                                                      | `lines[]`, `dueDate` changes                     | EInvoice updated                              | None           | `INVOICE_NOT_DRAFT`, `VALIDATION_ERROR`           |
| INV-003 | Delete invoice     | USER  | Invoice.status = DRAFT                                 | `invoiceId` from context                                                                      | Confirmation                                     | EInvoice deleted                              | None           | `INVOICE_NOT_DRAFT`                               |
| INV-004 | Issue invoice      | USER  | Invoice.status = DRAFT, lines exist                    | `invoiceId` from context                                                                      | Confirmation                                     | Status → PENDING_FISCALIZATION                | None           | `NO_LINES`, `INVALID_BUYER`                       |
| INV-005 | Fiscalize invoice  | USER  | Status = PENDING_FISCALIZATION, certificate configured | `invoiceId`, ZKI calculation, XML generation                                                  | Confirmation                                     | Status → FISCALIZED, JIR assigned             | Fiscal XML     | `CERT_MISSING`, `FINA_ERROR`, `DEADLINE_EXCEEDED` |
| INV-006 | Send invoice email | USER  | Invoice exists, buyer has email                        | `invoiceId`, buyer email, PDF generation                                                      | Confirmation                                     | emailMessageId stored                         | PDF attachment | `NO_EMAIL`, `SEND_FAILED`                         |
| INV-007 | Create credit note | USER  | Original invoice fiscalized                            | `originalInvoiceId`                                                                           | `reason`                                         | New EInvoice(DRAFT) linked                    | None           | `NOT_FISCALIZED`                                  |
| INV-008 | Mark invoice paid  | USER  | Invoice exists                                         | `invoiceId`                                                                                   | `paymentDate` (defaults to now)                  | Status → ACCEPTED, MatchRecord if bank linked | None           | `ALREADY_PAID`                                    |

### Expense Domain

| ID      | Capability               | Roles | Preconditions                     | Auto-Resolved Inputs                   | Required Intent                                          | State Changes                             | Artifacts      | Failure Modes                       |
| ------- | ------------------------ | ----- | --------------------------------- | -------------------------------------- | -------------------------------------------------------- | ----------------------------------------- | -------------- | ----------------------------------- |
| EXP-001 | Create expense           | USER  | Company selected                  | `companyId`, `userId`, VAT calculation | `vendorId`/`vendorName`, `amount`, `category`, `date`    | Expense(DRAFT), ExpenseLines, UraInput    | None           | `VALIDATION_ERROR`                  |
| EXP-002 | Update expense           | USER  | Expense.status = DRAFT or PENDING | `expenseId` from context               | Field changes                                            | Expense updated, ExpenseCorrection logged | None           | `VALIDATION_ERROR`                  |
| EXP-003 | Delete expense           | USER  | Expense.status = DRAFT            | `expenseId` from context               | Confirmation                                             | Expense deleted                           | None           | `NOT_DRAFT`                         |
| EXP-004 | Mark expense paid        | USER  | Expense exists                    | `expenseId` from context               | `paymentMethod`, `paymentDate` (default now)             | Status → PAID                             | None           | `ALREADY_PAID`                      |
| EXP-005 | Create recurring expense | USER  | Company selected                  | `companyId`                            | `amount`, `vendor`, `category`, `frequency`, `startDate` | RecurringExpense created                  | None           | `VALIDATION_ERROR`                  |
| EXP-006 | Extract from receipt     | USER  | Image/text provided               | `companyId`, AI model selection        | `image` OR `text`                                        | AIUsage tracked                           | Extracted JSON | `RATE_LIMITED`, `EXTRACTION_FAILED` |

### Banking Domain

| ID      | Capability                | Roles | Preconditions                | Auto-Resolved Inputs                       | Required Intent                     | State Changes                                | Artifacts | Failure Modes                                          |
| ------- | ------------------------- | ----- | ---------------------------- | ------------------------------------------ | ----------------------------------- | -------------------------------------------- | --------- | ------------------------------------------------------ |
| BNK-001 | Create bank account       | USER  | Company selected             | `companyId`, IBAN validation               | `iban`, `bankName`, `accountName`   | BankAccount created, set as default if first | None      | `INVALID_IBAN`, `DUPLICATE`                            |
| BNK-002 | Connect bank (GoCardless) | USER  | Bank account exists          | Institution list, OAuth flow               | `institutionId`, OAuth consent      | Account connected, status → CONNECTED        | None      | `CONSENT_DENIED`, `INSTITUTION_UNAVAILABLE`            |
| BNK-003 | Import bank statement     | USER  | Bank account exists          | Checksum deduplication, format detection   | `file` (PDF/XML)                    | BankTransactions created, ImportJob tracked  | None      | `INVALID_FORMAT`, `DUPLICATE_IMPORT`, `VIRUS_DETECTED` |
| BNK-004 | Auto-match transactions   | USER  | Unmatched transactions exist | Matching algorithm, invoice/expense lookup | `bankAccountId`                     | MatchRecords created, status → AUTO_MATCHED  | None      | `NO_MATCHES`                                           |
| BNK-005 | Manual match transaction  | USER  | Transaction UNMATCHED        | `transactionId` from context               | `type` (invoice/expense), `matchId` | MatchRecord created, status → MANUAL_MATCHED | None      | `ALREADY_MATCHED`, `MATCH_NOT_FOUND`                   |
| BNK-006 | Unmatch transaction       | USER  | Transaction matched          | `transactionId` from context               | Confirmation                        | MatchRecord removed, status → UNMATCHED      | None      | `NOT_MATCHED`                                          |
| BNK-007 | Ignore transaction        | USER  | Transaction UNMATCHED        | `transactionId` from context               | Confirmation                        | Status → IGNORED                             | None      | `ALREADY_IGNORED`                                      |

### Fiscalization Domain

| ID      | Capability         | Roles | Preconditions                              | Auto-Resolved Inputs      | Required Intent                           | State Changes                      | Artifacts      | Failure Modes                    |
| ------- | ------------------ | ----- | ------------------------------------------ | ------------------------- | ----------------------------------------- | ---------------------------------- | -------------- | -------------------------------- |
| FSC-001 | Upload certificate | USER  | Company selected                           | Encryption key            | `certificateFile`, `password`             | Certificate stored encrypted       | None           | `INVALID_CERT`, `WRONG_PASSWORD` |
| FSC-002 | Configure premises | USER  | Company selected                           | `companyId`               | `premisesName`, `premisesCode`, `address` | BusinessPremises created           | None           | `VALIDATION_ERROR`               |
| FSC-003 | Configure device   | USER  | Premises exists                            | `premisesId` from context | `deviceCode`, `deviceName`                | PaymentDevice created              | None           | `DUPLICATE_CODE`                 |
| FSC-004 | Process POS sale   | USER  | Premises + device + certificate configured | ZKI, fiscalization        | `lines[]`, `paymentMethod`                | EInvoice(FISCALIZED), JIR assigned | Fiscal receipt | `CERT_MISSING`, `FINA_ERROR`     |

**BLOCKED Capability:**

| ID      | Capability                    | Block Reason               | Resolution                       |
| ------- | ----------------------------- | -------------------------- | -------------------------------- |
| FSC-005 | Fiscalize without certificate | Certificate not configured | User must complete FSC-001 first |

### Contact Domain

| ID      | Capability      | Roles | Preconditions                               | Auto-Resolved Inputs        | Required Intent                                      | State Changes            | Artifacts      | Failure Modes                       |
| ------- | --------------- | ----- | ------------------------------------------- | --------------------------- | ---------------------------------------------------- | ------------------------ | -------------- | ----------------------------------- |
| CON-001 | Create contact  | USER  | Company selected                            | `companyId`, OIB validation | `name`, `oib` (optional), `type`, `email`, `address` | Contact created          | None           | `DUPLICATE_OIB`, `VALIDATION_ERROR` |
| CON-002 | Update contact  | USER  | Contact exists                              | `contactId` from context    | Field changes                                        | Contact updated          | None           | `VALIDATION_ERROR`                  |
| CON-003 | Delete contact  | USER  | Contact exists, no linked invoices/expenses | `contactId` from context    | Confirmation                                         | Contact deleted          | None           | `HAS_LINKED_RECORDS`                |
| CON-004 | Search contacts | USER  | Company selected                            | `companyId`                 | `query`                                              | None (read-only)         | Search results | None                                |
| CON-005 | Import contacts | USER  | Company selected                            | Deduplication by OIB        | `file` (CSV)                                         | Contacts created/updated | Import report  | `INVALID_FORMAT`                    |

### Product Domain

| ID      | Capability            | Roles | Preconditions                                       | Auto-Resolved Inputs         | Required Intent                      | State Changes    | Artifacts      | Failure Modes                  |
| ------- | --------------------- | ----- | --------------------------------------------------- | ---------------------------- | ------------------------------------ | ---------------- | -------------- | ------------------------------ |
| PRD-001 | Create product        | USER  | Company selected                                    | `companyId`, VAT rate lookup | `name`, `price`, `unit`, `vatRateId` | Product created  | None           | `VALIDATION_ERROR`             |
| PRD-002 | Update product        | USER  | Product exists                                      | `productId` from context     | Field changes                        | Product updated  | None           | `VALIDATION_ERROR`             |
| PRD-003 | Delete product        | USER  | Product exists, created < 24hrs OR no invoice links | `productId` from context     | Confirmation                         | Product deleted  | None           | `TOO_OLD`, `HAS_INVOICE_LINKS` |
| PRD-004 | Search products       | USER  | Company selected                                    | `companyId`                  | `query`                              | None (read-only) | Search results | None                           |
| PRD-005 | Inline update product | USER  | Product exists                                      | `productId` from context     | Single field change                  | Product updated  | None           | `VALIDATION_ERROR`             |

### Accounting Period Domain

| ID      | Capability               | Roles        | Preconditions                | Auto-Resolved Inputs                         | Required Intent                                    | State Changes                            | Artifacts | Failure Modes        |
| ------- | ------------------------ | ------------ | ---------------------------- | -------------------------------------------- | -------------------------------------------------- | ---------------------------------------- | --------- | -------------------- |
| PER-001 | Create accounting period | USER         | Company selected             | `companyId`, period number calculation       | `startDate`, `endDate`, `periodType`, `fiscalYear` | AccountingPeriod created                 | None      | `OVERLAPPING_PERIOD` |
| PER-002 | Lock accounting period   | USER, STAFF  | Period exists, status = OPEN | `periodId` from context, `userId`, timestamp | `reason` (optional)                                | Status → LOCKED, lockedAt/lockedById set | None      | `ALREADY_LOCKED`     |
| PER-003 | Unlock accounting period | STAFF, ADMIN | Period LOCKED                | `periodId` from context                      | `reason`                                           | Status → OPEN, lockedAt cleared          | None      | `NOT_LOCKED`         |

**AUDIT NOTE:** Period lock does not currently prevent mutations. This is a known gap (see SYSTEM_REALITY_SCAN.md section 6).

### AI Assistant Domain

| ID      | Capability           | Roles        | Preconditions    | Auto-Resolved Inputs                                    | Required Intent            | State Changes   | Artifacts                    | Failure Modes      |
| ------- | -------------------- | ------------ | ---------------- | ------------------------------------------------------- | -------------------------- | --------------- | ---------------------------- | ------------------ |
| AST-001 | Query assistant      | PUBLIC, USER | None             | `surface` (MARKETING/APP), `companyId` if authenticated | `query` (1-4000 chars)     | None            | NDJSON stream with citations | `VALIDATION_ERROR` |
| AST-002 | Extract receipt data | USER         | Company selected | `companyId`, AI model                                   | `image` (base64) OR `text` | AIUsage tracked | Extracted JSON               | `RATE_LIMITED`     |

### Company Management Domain

| ID      | Capability               | Roles        | Preconditions      | Auto-Resolved Inputs     | Required Intent                       | State Changes                       | Artifacts | Failure Modes      |
| ------- | ------------------------ | ------------ | ------------------ | ------------------------ | ------------------------------------- | ----------------------------------- | --------- | ------------------ |
| CMP-001 | Create company           | USER         | Authenticated      | `userId`                 | `name`, `oib`, `legalForm`, `address` | Company created, CompanyUser(OWNER) | None      | `DUPLICATE_OIB`    |
| CMP-002 | Update company           | OWNER, ADMIN | Company selected   | `companyId` from context | Field changes                         | Company updated, AuditLog           | None      | `VALIDATION_ERROR` |
| CMP-003 | Switch company           | USER         | Multiple companies | Available companies list | `companyId` selection                 | User.defaultCompanyId updated       | None      | `NOT_MEMBER`       |
| CMP-004 | Update plan/entitlements | OWNER        | Company selected   | `companyId` from context | `plan`, `legalForm`, `entitlements[]` | Company updated, AuditLog           | None      | `VALIDATION_ERROR` |

### Staff Operations Domain

| ID      | Capability            | Roles | Preconditions            | Auto-Resolved Inputs          | Required Intent        | State Changes               | Artifacts   | Failure Modes    |
| ------- | --------------------- | ----- | ------------------------ | ----------------------------- | ---------------------- | --------------------------- | ----------- | ---------------- |
| STF-001 | View assigned clients | STAFF | Staff user authenticated | `staffId`, assignments lookup | None                   | None (read-only)            | Client list | None             |
| STF-002 | View client data      | STAFF | Client assigned to staff | `clientId`, assignment check  | None                   | AuditLog(STAFF_VIEW_CLIENT) | Client data | `NOT_ASSIGNED`   |
| STF-003 | Invite client         | STAFF | Authenticated            | `staffId`                     | `email`, `companyName` | Invitation created          | Email sent  | `ALREADY_EXISTS` |
| STF-004 | Mark client reviewed  | STAFF | Client assigned          | `clientId`, `reviewPeriod`    | None                   | ReviewMark created          | None        | `NOT_ASSIGNED`   |

### Admin Operations Domain

| ID      | Capability                   | Roles | Preconditions                     | Auto-Resolved Inputs          | Required Intent                       | State Changes               | Artifacts      | Failure Modes            |
| ------- | ---------------------------- | ----- | --------------------------------- | ----------------------------- | ------------------------------------- | --------------------------- | -------------- | ------------------------ |
| ADM-001 | View all tenants             | ADMIN | Authenticated                     | Tenant list                   | None                                  | None                        | Tenant list    | None                     |
| ADM-002 | View tenant detail           | ADMIN | Tenant exists                     | `tenantId`                    | None                                  | AuditLog                    | Tenant data    | `NOT_FOUND`              |
| ADM-003 | Export tenant audit log      | ADMIN | Tenant exists                     | `tenantId`, sanitization      | `limit` (optional)                    | None                        | CSV file       | None                     |
| ADM-004 | Manage feature flags         | ADMIN | Authenticated                     | Flag list                     | `key`, `scope`, `status`, `reason`    | FeatureFlag created/updated | AuditLog       | `DUPLICATE_KEY`          |
| ADM-005 | Create staff assignment      | ADMIN | Staff user exists, company exists | `staffId`, `companyId` lookup | Notes (optional)                      | StaffAssignment created     | None           | `DUPLICATE`, `NOT_STAFF` |
| ADM-006 | Bootstrap regulatory sources | ADMIN | RTL not seeded                    | Source list                   | Confirmation                          | Sources seeded              | None           | `ALREADY_SEEDED`         |
| ADM-007 | View RTL status              | ADMIN | Authenticated                     | Health calculation            | None                                  | None                        | Health metrics | None                     |
| ADM-008 | Trigger news pipeline        | ADMIN | Authenticated                     | `CRON_SECRET`                 | `job` (fetch-classify/review/publish) | Pipeline triggered          | Job result     | `INVALID_JOB`            |

---

## 3. Workflow Definitions

### WF-001: Invoice Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│ TRIGGER: User intent to invoice a customer                         │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: Select/Create Buyer                                        │
│ ├─ IF buyer exists → AUTO-RESOLVE buyerId                          │
│ └─ IF new → REQUIRE CON-001 (name, oib, email)                      │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: Add Invoice Lines                                          │
│ ├─ IF product exists → AUTO-RESOLVE product data                   │
│ └─ IF custom → REQUIRE (description, quantity, price, vatRate)     │
│ ├─ VAT calculation: AUTOMATIC                                      │
│ └─ Totals: AUTOMATIC                                                │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: INV-001 Create Invoice (DRAFT)                             │
│ └─ AUTOMATIC: invoiceNumber, createdAt, companyId                  │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: INV-004 Issue Invoice                                      │
│ ├─ REQUIRE: Confirmation                                           │
│ └─ BLOCKS IF: No lines, invalid buyer                              │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5: INV-005 Fiscalize Invoice                                  │
│ ├─ AUTOMATIC: ZKI calculation, XML generation                     │
│ ├─ REQUIRE: Confirmation                                           │
│ ├─ BLOCKS IF: Certificate not configured                           │
│ └─ EXTERNAL: FINA/CIS submission → JIR returned                    │
│     └─ DEADLINE: 48 hours (regulatory)                             │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 6: INV-006 Send Invoice Email (OPTIONAL)                      │
│ ├─ AUTOMATIC: PDF generation                                       │
│ ├─ AUTO-RESOLVE: Buyer email                                       │
│ └─ REQUIRE: Confirmation                                           │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 7: INV-008 Mark Paid (WHEN PAYMENT RECEIVED)                  │
│ ├─ IF bank matched → AUTOMATIC via BNK-004/005                     │
│ └─ IF manual → REQUIRE paymentDate                                 │
└─────────────────────────────────────────────────────────────────────┘

CORRECTION BRANCH (from FISCALIZED):
┌─────────────────────────────────────────────────────────────────────┐
│ INV-007: Create Credit Note                                        │
│ ├─ REQUIRE: reason                                                 │
│ └─ Creates new invoice linked to original                          │
└─────────────────────────────────────────────────────────────────────┘
```

### WF-002: Expense Recording

```
┌─────────────────────────────────────────────────────────────────────┐
│ TRIGGER: Receipt received OR expense incurred                      │
└─────────────────────────────────────────────────────────────────────┘
         │
         ├─────────────────────────────────────────┐
         │                                         │
         ▼                                         ▼
┌─────────────────────────┐           ┌─────────────────────────────────┐
│ PATH A: AI Extraction    │           │ PATH B: Manual Entry            │
│ EXP-006: Extract receipt │           │ REQUIRE: vendor, amount,        │
│ └─ AUTOMATIC: OCR, parse │           │          category, date          │
└─────────────────────────┘           └─────────────────────────────────┘
         │                                         │
         └─────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: EXP-001 Create Expense                                     │
│ ├─ AUTOMATIC: VAT calculation, UraInput creation                  │
│ └─ AUTO-RESOLVE: companyId, userId                                 │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: EXP-004 Mark Paid (WHEN PAYMENT MADE)                      │
│ ├─ IF bank matched → AUTOMATIC                                     │
│ └─ IF manual → REQUIRE paymentMethod, paymentDate                  │
└─────────────────────────────────────────────────────────────────────┘
```

### WF-003: Bank Reconciliation

```
┌─────────────────────────────────────────────────────────────────────┐
│ TRIGGER: Bank statement available OR sync triggered                │
└─────────────────────────────────────────────────────────────────────┘
         │
         ├─────────────────────────────────────────┐
         │                                         │
         ▼                                         ▼
┌─────────────────────────┐           ┌─────────────────────────────────┐
│ PATH A: File Import     │           │ PATH B: Auto Sync (GoCardless)  │
│ BNK-003: Upload file    │           │ AUTOMATIC via cron/bank-sync    │
│ └─ REQUIRE: file        │           │ └─ 90-day consent refresh       │
└─────────────────────────┘           └─────────────────────────────────┘
         │                                         │
         └─────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: BNK-004 Auto-Match Transactions                            │
│ ├─ AUTOMATIC: Algorithm matches by amount, reference, date         │
│ └─ CONFIDENCE: High matches auto-applied, low require review       │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: Review Unmatched (QUEUE)                                   │
│ ├─ BNK-005: Manual match → REQUIRE type, matchId                   │
│ ├─ BNK-007: Ignore → REQUIRE confirmation                          │
│ └─ OR create new expense/invoice for unknown transactions          │
└─────────────────────────────────────────────────────────────────────┘
```

### WF-004: Fiscal Setup

```
┌─────────────────────────────────────────────────────────────────────┐
│ TRIGGER: Company needs fiscalization capability                    │
│ └─ BLOCKS: All fiscalization until complete                        │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: FSC-001 Upload Certificate                                 │
│ ├─ REQUIRE: P12 file, password                                     │
│ └─ AUTOMATIC: Encryption, validation                               │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: FSC-002 Configure Premises                                 │
│ └─ REQUIRE: premisesName, premisesCode, address                    │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: FSC-003 Configure Device                                   │
│ └─ REQUIRE: deviceCode, deviceName                                 │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ COMPLETE: Fiscalization capability UNBLOCKED                       │
└─────────────────────────────────────────────────────────────────────┘
```

### WF-005: Accounting Period Close

```
┌─────────────────────────────────────────────────────────────────────┐
│ TRIGGER: End of accounting period                                  │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: Review all open transactions                               │
│ ├─ BNK-004: Auto-match remaining                                   │
│ └─ QUEUE: Unreconciled items for review                            │
└─────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: PER-002 Lock Period                                        │
│ ├─ REQUIRE: Confirmation from STAFF or USER                        │
│ └─ NOTE: Lock enforcement incomplete (audit finding)               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Role Control Centers

### 4.1 Client / Company Operator Control Center

**Responsibilities:**

- Record business transactions (invoices, expenses)
- Manage business data (contacts, products)
- Initiate fiscalization
- Reconcile bank transactions
- View business reports

**Queues (Actionable Items):**
| Queue | Source | Action Required |
|-------|--------|-----------------|
| Draft Invoices | INV-001 | Issue or delete |
| Pending Fiscalization | INV-004 | Fiscalize (48h deadline) |
| Unmatched Transactions | BNK-003/sync | Match, ignore, or create record |
| Unpaid Invoices | Time-based | Follow up or mark paid |
| Unpaid Expenses | Time-based | Mark paid |

**Visible Workflows:**

- WF-001: Invoice Lifecycle (all steps)
- WF-002: Expense Recording (all steps)
- WF-003: Bank Reconciliation (all steps)
- WF-004: Fiscal Setup (all steps)
- WF-005: Period Close (initiate only, lock requires STAFF approval for production use)

**Non-Visible System States:**

- Fiscal queue processing status
- AI extraction quotas/usage
- Background sync status
- Regulatory rule updates

**Never Allowed:**

- Access other companies' data
- Unlock accounting periods (STAFF only)
- Modify system configuration
- Access admin/staff portals

---

### 4.2 Accountant / Staff Control Center

**Responsibilities:**

- Oversee multiple client companies
- Review and approve period closes
- Unlock accounting periods when correction needed
- Generate consolidated reports
- Invite and manage client relationships

**Queues (Actionable Items):**
| Queue | Source | Action Required |
|-------|--------|-----------------|
| Clients Pending Review | STF-004 | Review and mark complete |
| Period Lock Requests | Client-initiated | Approve or request corrections |
| Client Invitations Pending | STF-003 | Follow up |
| Escalated Issues | Client support | Resolve |

**Visible Workflows (Own Clients Only):**

- All client workflows (read + limited write)
- WF-005: Period Close (approval authority)
- Client data review

**Authority Over Clients:**
| Action | Authority |
|--------|-----------|
| View invoices | READ |
| View expenses | READ |
| View bank transactions | READ |
| View reports | READ |
| Lock period | EXECUTE |
| Unlock period | EXECUTE |
| Modify data | NONE (audit trail only) |

**Non-Visible System States:**

- Other staff assignments
- Admin-level metrics
- Platform configuration
- Regulatory pipeline internals

**Never Allowed:**

- Access unassigned clients
- Modify client data directly
- Create/delete client entities
- Access admin portal

---

### 4.3 Admin / Platform Owner Control Center

**Responsibilities:**

- Platform health monitoring
- Tenant management
- Feature flag control
- Regulatory truth layer management
- Staff assignment management
- System configuration

**Queues (Actionable Items):**
| Queue | Source | Action Required |
|-------|--------|-----------------|
| System Alerts | Monitoring | Investigate and resolve |
| RTL Conflicts | Regulatory pipeline | Resolve or escalate |
| Pending News | News pipeline | Review and publish |
| Failed Jobs | DLQ | Investigate and retry |

**Visible Workflows:**

- ADM-001 through ADM-008 (all admin operations)
- RTL pipeline monitoring
- News pipeline management
- Tenant health dashboards

**Platform Authority:**
| Scope | Authority |
|-------|-----------|
| Feature flags | Full CRUD |
| Staff assignments | Full CRUD |
| Tenant viewing | READ |
| Tenant modification | NONE (support only) |
| RTL sources | Seed, monitor |
| News pipeline | Trigger, review, publish |

**Non-Visible System States:**

- Individual tenant data content
- Client financial details
- Specific invoice/expense data

**Never Allowed:**

- Access tenant data content (privacy boundary)
- Modify tenant financial records
- Impersonate users
- Bypass audit logging

---

## 5. Input Minimization Contract

### Input Source Classification

| Source       | Definition                    | Example                                |
| ------------ | ----------------------------- | -------------------------------------- |
| INTERNAL     | Data already in system        | `companyId`, `userId`, `invoiceNumber` |
| EXTERNAL     | Data from integrations        | Bank transactions, fiscal JIR          |
| DERIVED      | Calculated from existing data | VAT totals, ZKI hash                   |
| HUMAN INTENT | User decision required        | Buyer selection, amount, confirmation  |

### Per-Capability Input Analysis

#### INV-001: Create Invoice

| Input           | Source       | Justification                          |
| --------------- | ------------ | -------------------------------------- |
| `companyId`     | INTERNAL     | From session                           |
| `userId`        | INTERNAL     | From session                           |
| `invoiceNumber` | DERIVED      | Auto-increment                         |
| `createdAt`     | INTERNAL     | System clock                           |
| `buyerId`       | HUMAN INTENT | User must choose recipient             |
| `lines[]`       | HUMAN INTENT | User defines what to invoice           |
| `dueDate`       | HUMAN INTENT | User defines terms (default available) |
| `paymentMethod` | HUMAN INTENT | User selects                           |
| Line VAT rates  | DERIVED      | From product or manual selection       |
| Line totals     | DERIVED      | Calculated                             |
| Invoice total   | DERIVED      | Sum of lines                           |

**Status: COMPLIANT** - Only true intent required from user.

#### EXP-001: Create Expense

| Input                   | Source       | Justification                   |
| ----------------------- | ------------ | ------------------------------- |
| `companyId`             | INTERNAL     | From session                    |
| `userId`                | INTERNAL     | From session                    |
| `vendorId`/`vendorName` | HUMAN INTENT | User identifies vendor          |
| `amount`                | HUMAN INTENT | From receipt (or AI extraction) |
| `category`              | HUMAN INTENT | User categorization             |
| `date`                  | HUMAN INTENT | When expense occurred           |
| VAT calculation         | DERIVED      | From amount and category        |

**Status: COMPLIANT** - AI extraction path minimizes manual input.

#### BNK-003: Import Bank Statement

| Input            | Source       | Justification                         |
| ---------------- | ------------ | ------------------------------------- |
| `companyId`      | INTERNAL     | From session                          |
| `bankAccountId`  | INTERNAL     | From context or selection if multiple |
| `file`           | HUMAN INTENT | User provides file                    |
| Format detection | DERIVED      | From file content                     |
| Deduplication    | DERIVED      | Checksum comparison                   |

**Status: COMPLIANT**

#### FSC-001: Upload Certificate

| Input             | Source       | Justification                         |
| ----------------- | ------------ | ------------------------------------- |
| `companyId`       | INTERNAL     | From session                          |
| `certificateFile` | HUMAN INTENT | Security-sensitive, user must provide |
| `password`        | HUMAN INTENT | Security-sensitive, user must provide |
| Encryption        | DERIVED      | System handles                        |

**Status: COMPLIANT** - Security inputs cannot be auto-resolved.

### UX Violation List

**No violations detected.** All HUMAN INTENT inputs in the current capability set are justified:

- Security credentials (cannot be auto-resolved)
- Business decisions (buyer, amounts, categories)
- Confirmations for irreversible actions

---

## 6. AI Orchestrator Contract

### Intent Expression Format

```typescript
interface AIIntent {
  // What the user/AI wants to accomplish
  capability: CapabilityID // e.g., "INV-001"

  // Known inputs (may be partial)
  inputs: Record<string, unknown>

  // Context for resolution
  context: {
    companyId?: string
    userId?: string
    sessionId?: string
  }
}
```

### Resolution Protocol

```typescript
interface ResolutionResult {
  status: "READY" | "MISSING_INPUTS" | "BLOCKED" | "UNAUTHORIZED"

  // If READY: All inputs resolved
  resolvedInputs?: Record<string, unknown>

  // If MISSING_INPUTS: What's needed
  missingInputs?: Array<{
    field: string
    type: string
    description: string
    options?: unknown[] // For selection fields
  }>

  // If BLOCKED: Why and how to unblock
  blocker?: {
    reason: string
    code: BlockerCode
    resolution: CapabilityID[] // Capabilities to complete first
  }

  // If UNAUTHORIZED: Clear denial
  unauthorized?: {
    requiredRole: Role
    currentRole: Role
  }
}
```

### Execution Protocol

```typescript
interface ExecutionRequest {
  capability: CapabilityID
  resolvedInputs: Record<string, unknown>
  confirmations: {
    [actionId: string]: boolean
  }
}

interface ExecutionResult {
  status: "SUCCESS" | "FAILED" | "REQUIRES_CONFIRMATION"

  // If SUCCESS: What changed
  stateChanges?: Array<{
    entity: string
    id: string
    change: string
  }>
  artifacts?: Array<{
    type: string
    location: string
  }>

  // If FAILED: Machine-readable error
  error?: {
    code: string
    message: string
    context: Record<string, unknown>
  }

  // If REQUIRES_CONFIRMATION: What needs approval
  pendingConfirmations?: Array<{
    actionId: string
    description: string
    reversible: boolean
  }>
}
```

### Blocker Codes

| Code                | Meaning                           | Resolution                  |
| ------------------- | --------------------------------- | --------------------------- |
| `CERT_MISSING`      | Fiscal certificate not configured | Complete FSC-001            |
| `PREMISES_MISSING`  | No business premises configured   | Complete FSC-002            |
| `DEVICE_MISSING`    | No payment device configured      | Complete FSC-003            |
| `PERIOD_LOCKED`     | Accounting period is locked       | Request PER-003 (unlock)    |
| `INVOICE_NOT_DRAFT` | Invoice not in editable state     | Create correction (INV-007) |
| `RATE_LIMITED`      | AI quota exceeded                 | Wait or upgrade plan        |
| `UNAUTHORIZED`      | Role insufficient                 | Request elevation           |

### AI Agent Guarantees

The system guarantees AI agents:

1. **Deterministic resolution** - Same inputs always produce same resolution result
2. **Complete blocker information** - All blockers include resolution path
3. **Atomic execution** - Operations succeed or fail completely, no partial state
4. **Machine-readable errors** - All failures include structured error codes
5. **State queryability** - Current state of any entity queryable before action

### AI Agent Limitations

AI agents cannot:

1. **Bypass confirmations** - Irreversible actions require explicit confirmation
2. **Access cross-tenant data** - Tenant isolation enforced
3. **Execute UI-only operations** - Calculators have no API
4. **Override security inputs** - Certificates/passwords require human

---

## 7. UI Responsibility & Prohibition Rules

### UI Allowed Responsibilities

| Responsibility       | Description                                 | Example                                     |
| -------------------- | ------------------------------------------- | ------------------------------------------- |
| Display state        | Show current data from backend              | Invoice list, status badges                 |
| Explain blockers     | Show why action unavailable with resolution | "Configure certificate to fiscalize"        |
| Collect intent       | Gather user decisions for capability inputs | Buyer selector, line item form              |
| Confirm irreversible | Request explicit approval                   | "Fiscalize invoice? This cannot be undone." |
| Show progress        | Display async operation status              | Fiscalization pending indicator             |
| Surface queues       | Present actionable items                    | Unmatched transactions list                 |
| Navigate             | Route between capability entry points       | Menu, breadcrumbs                           |

### UI Forbidden Logic

| Prohibition                 | Rationale                         | Correct Approach                         |
| --------------------------- | --------------------------------- | ---------------------------------------- |
| Calculate totals            | Domain logic must be backend      | Request calculated values from server    |
| Validate business rules     | Enforcement must be domain-level  | Show server-side validation errors       |
| Determine state transitions | State machine is domain logic     | Query allowed actions from backend       |
| Infer blocked reasons       | Blocker logic is complex          | Display blocker from resolution API      |
| Auto-fill derived data      | Derivation rules are domain       | Request derived values from server       |
| Check permissions           | Authorization is server-side      | Hide/disable based on server response    |
| Store business state        | Single source of truth is backend | Use server state, cache only for display |

### UI Invariants

UI must respect these invariants:

| Invariant                  | UI Behavior                              |
| -------------------------- | ---------------------------------------- |
| Money is Decimal(2)        | Display formatted, never parse/calculate |
| Invoice status transitions | Show only allowed actions from server    |
| 48-hour fiscal deadline    | Display countdown, cannot extend         |
| Tenant isolation           | Never request cross-company data         |
| Confirmation required      | Never auto-submit irreversible actions   |

### UI Guarantees from Backend

Backend guarantees to UI:

| Guarantee                | Meaning                                     |
| ------------------------ | ------------------------------------------- |
| Atomic responses         | Partial data never returned                 |
| Consistent state         | No stale data after mutation                |
| Error structure          | All errors include code + message           |
| Capability availability  | Clear AVAILABLE/BLOCKED/UNAVAILABLE         |
| Blocker resolution paths | Blocked capabilities include how to unblock |
| Role-filtered data       | Only authorized data in responses           |

### UI-Specific Implementation Notes

1. **No client-side state machines** - Query allowed actions from server
2. **No client-side validation alone** - Always re-validate server-side
3. **No optimistic updates for critical operations** - Wait for server confirmation
4. **No local calculation of financial data** - All money math on server
5. **No caching of authorization state** - Re-check per request
6. **No UI-triggered background jobs** - Use server actions or API routes

---

## Appendix: Capability ID Reference

| ID      | Domain        | Capability                   |
| ------- | ------------- | ---------------------------- |
| INV-001 | Invoicing     | Create invoice               |
| INV-002 | Invoicing     | Update invoice               |
| INV-003 | Invoicing     | Delete invoice               |
| INV-004 | Invoicing     | Issue invoice                |
| INV-005 | Invoicing     | Fiscalize invoice            |
| INV-006 | Invoicing     | Send invoice email           |
| INV-007 | Invoicing     | Create credit note           |
| INV-008 | Invoicing     | Mark invoice paid            |
| EXP-001 | Expenses      | Create expense               |
| EXP-002 | Expenses      | Update expense               |
| EXP-003 | Expenses      | Delete expense               |
| EXP-004 | Expenses      | Mark expense paid            |
| EXP-005 | Expenses      | Create recurring expense     |
| EXP-006 | Expenses      | Extract from receipt         |
| BNK-001 | Banking       | Create bank account          |
| BNK-002 | Banking       | Connect bank                 |
| BNK-003 | Banking       | Import bank statement        |
| BNK-004 | Banking       | Auto-match transactions      |
| BNK-005 | Banking       | Manual match transaction     |
| BNK-006 | Banking       | Unmatch transaction          |
| BNK-007 | Banking       | Ignore transaction           |
| FSC-001 | Fiscalization | Upload certificate           |
| FSC-002 | Fiscalization | Configure premises           |
| FSC-003 | Fiscalization | Configure device             |
| FSC-004 | Fiscalization | Process POS sale             |
| CON-001 | Contacts      | Create contact               |
| CON-002 | Contacts      | Update contact               |
| CON-003 | Contacts      | Delete contact               |
| CON-004 | Contacts      | Search contacts              |
| CON-005 | Contacts      | Import contacts              |
| PRD-001 | Products      | Create product               |
| PRD-002 | Products      | Update product               |
| PRD-003 | Products      | Delete product               |
| PRD-004 | Products      | Search products              |
| PRD-005 | Products      | Inline update product        |
| PER-001 | Periods       | Create accounting period     |
| PER-002 | Periods       | Lock accounting period       |
| PER-003 | Periods       | Unlock accounting period     |
| AST-001 | AI            | Query assistant              |
| AST-002 | AI            | Extract receipt data         |
| CMP-001 | Company       | Create company               |
| CMP-002 | Company       | Update company               |
| CMP-003 | Company       | Switch company               |
| CMP-004 | Company       | Update plan/entitlements     |
| STF-001 | Staff         | View assigned clients        |
| STF-002 | Staff         | View client data             |
| STF-003 | Staff         | Invite client                |
| STF-004 | Staff         | Mark client reviewed         |
| ADM-001 | Admin         | View all tenants             |
| ADM-002 | Admin         | View tenant detail           |
| ADM-003 | Admin         | Export tenant audit log      |
| ADM-004 | Admin         | Manage feature flags         |
| ADM-005 | Admin         | Create staff assignment      |
| ADM-006 | Admin         | Bootstrap regulatory sources |
| ADM-007 | Admin         | View RTL status              |
| ADM-008 | Admin         | Trigger news pipeline        |

---

_This document is the authoritative contract for UI redesign. All UI implementations must conform to these specifications. Deviations require explicit approval and contract amendment._
