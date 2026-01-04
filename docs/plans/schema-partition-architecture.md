# Schema Partition Architecture Plan

> Created: 2026-01-02
> Branch: `chore/schema-partition-rtl`
> Status: PROPOSED

## Decision: Option 1 (Two Prisma Schema Files + Two DB Connections)

### Chosen Architecture

```
prisma/
├── schema.prisma        # Core transactional (A models only)
└── regulatory.prisma    # RTL/Archive (B models only)

src/lib/db/
├── core.ts              # export const db = new PrismaClient()
└── regulatory.ts        # export const dbReg = new PrismaClientRegulatory()
```

### Justification

| Factor                   | Option 1                        | Option 2                         | Option 3            |
| ------------------------ | ------------------------------- | -------------------------------- | ------------------- |
| Migration isolation      | ✅ Fully isolated               | ⚠️ Same DB, namespace collisions | ❌ Coupled          |
| Deploy independence      | ✅ RTL deploys don't block core | ⚠️ Still same migration history  | ❌ Coupled          |
| Connection pooling       | ✅ Separate pools               | ⚠️ Shared pool                   | ⚠️ Shared pool      |
| Backup/restore           | ✅ Can backup RTL separately    | ⚠️ Same backup                   | ❌ Same backup      |
| Cross-reference handling | ⚠️ String IDs, no FK            | ⚠️ Cross-schema FKs              | ✅ Normal FKs       |
| Complexity               | Medium                          | Medium-High                      | Low                 |
| Future scaling           | ✅ Can move to separate DB      | ⚠️ Harder to separate            | ❌ Hard to separate |

**Decision:** Option 1 wins because:

1. RTL schema changes are frequent (new shapes, new fields) - isolation prevents blocking core
2. Evidence tables grow unbounded - separate connection pool prevents core starvation
3. Regulatory data has different retention requirements - separate DB enables different backup policies
4. Clear boundary prevents accidental coupling

---

## Cross-Reference Strategy

### Current Cross-Links (Core → RTL)

| Core Model  | Field     | RTL Model      | Strategy                             |
| ----------- | --------- | -------------- | ------------------------------------ |
| EInvoice    | vatRuleId | RegulatoryRule | Convert to `String` (soft reference) |
| PostingRule | vatRuleId | RegulatoryRule | Convert to `String` (soft reference) |

### Implementation Pattern

```typescript
// Before: Hard FK
model EInvoice {
  vatRuleId String?
  vatRule   RegulatoryRule? @relation(fields: [vatRuleId], references: [id])
}

// After: Soft reference
model EInvoice {
  vatRuleId String? // Soft reference to RegulatoryRule.id
  // No @relation - lookup via dbReg when needed
}
```

```typescript
// Usage in code
const invoice = await db.eInvoice.findUnique({ where: { id } })
const vatRule = invoice.vatRuleId
  ? await dbReg.regulatoryRule.findUnique({ where: { id: invoice.vatRuleId } })
  : null
```

### RTL → Core (None Required)

RTL models do NOT reference core models. Evidence/rules are self-contained.

---

## Migration Approach

### Phase 1: Prepare (No schema changes)

1. Create `prisma/regulatory.prisma` with generator config
2. Create `src/lib/db/core.ts` and `src/lib/db/regulatory.ts`
3. Update all RTL code to use `dbReg` instead of `db`
4. Verify tests pass with both clients

### Phase 2: Split Schema

1. Move Category B models from `schema.prisma` to `regulatory.prisma`
2. Convert cross-reference FKs to String (EInvoice.vatRuleId)
3. Generate both Prisma clients
4. Run migration on core schema (removing RTL tables)
5. Run migration on regulatory schema (creating RTL tables)

### Phase 3: Data Migration

1. Export RTL data from current DB
2. Import into regulatory schema tables
3. Verify data integrity
4. Update soft references if needed

---

## Rollback Approach

### If Migration Fails Mid-Way

1. **Core schema rollback:** `npx prisma migrate resolve --rolled-back <migration_name>`
2. **Restore from backup:** RTL data preserved in backup
3. **Revert code changes:** Restore single-client imports

### If Post-Migration Issues Found

1. **Immediate (same day):**
   - Revert to single schema
   - Run combined migration
   - Restore FK constraints

2. **After production use:**
   - Fix forward only
   - Cannot safely restore FKs after data divergence

---

## Environment Configuration

### Current (Single DB)

```env
DATABASE_URL=postgresql://fiskai:xxx@host:5432/fiskai?schema=public
```

### Target (Two DBs)

```env
# Core transactional
DATABASE_URL=postgresql://fiskai:xxx@host:5432/fiskai?schema=public

# Regulatory archive (can be same DB, different schema)
DATABASE_URL_REGULATORY=postgresql://fiskai:xxx@host:5432/fiskai?schema=regulatory
```

### Option: Same DB, Different Schema

For initial rollout, use same DB with Postgres schema namespacing:

```sql
CREATE SCHEMA IF NOT EXISTS regulatory;
```

This allows:

- Single backup
- Easy cross-queries during transition
- Later migration to separate DB

---

## Prisma Configuration

### `prisma/schema.prisma` (Core)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Only Category A models
model Company { ... }
model User { ... }
model EInvoice {
  vatRuleId String? // Soft reference, no FK
}
```

### `prisma/regulatory.prisma` (RTL)

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/.prisma/regulatory"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL_REGULATORY")
}

// Category B models only
model Evidence { ... }
model RegulatoryRule { ... }
model Concept { ... }
```

### Client Initialization

```typescript
// src/lib/db/core.ts
import { PrismaClient } from "@prisma/client"
export const db = new PrismaClient()

// src/lib/db/regulatory.ts
import { PrismaClient as PrismaClientRegulatory } from ".prisma/regulatory"
export const dbReg = new PrismaClientRegulatory()
```

---

## File Impact Analysis

### Files Importing RTL Models

```
src/lib/regulatory-truth/     # 50+ files - change to dbReg
src/lib/vat/output-calculator.ts  # Uses RegulatoryRule
src/lib/fiscal-rules/         # Uses RuleVersion, RuleTable
scripts/                      # RTL scripts - change to dbReg
```

### Import Pattern Change

```typescript
// Before
import { db } from '@/lib/db';
const rule = await db.regulatoryRule.findUnique({ ... });

// After
import { dbReg } from '@/lib/db/regulatory';
const rule = await dbReg.regulatoryRule.findUnique({ ... });
```

---

## Which Client Where

| Code Path                   | Client     | Rationale                |
| --------------------------- | ---------- | ------------------------ |
| `src/app/(app)/`            | db         | Client-facing, core data |
| `src/app/(staff)/`          | db         | Staff-facing, core data  |
| `src/app/(admin)/`          | db + dbReg | Admin sees both          |
| `src/lib/regulatory-truth/` | dbReg      | RTL processing           |
| `src/lib/vat/`              | db + dbReg | Core + rule lookup       |
| `src/lib/fiscal-rules/`     | dbReg      | Rule management          |
| `src/infrastructure/`       | db         | Core repositories        |
| `scripts/`                  | varies     | Depends on purpose       |

---

## Risk Assessment

### Low Risk

- Creating regulatory.prisma file
- Creating separate client modules
- Updating RTL code paths

### Medium Risk

- Converting FK to soft reference (EInvoice.vatRuleId)
- Running parallel migrations
- Ensuring all imports updated

### High Risk

- Data migration between schemas
- Connection pool sizing
- Prisma client generation conflicts

### Mitigations

1. **FK conversion:** Keep column type same (String), just remove constraint
2. **Parallel migrations:** Test in staging with production data copy
3. **Import updates:** ESLint rule to enforce correct client usage
4. **Connection pools:** Start with same limits, monitor before adjusting

---

## PR Staging Plan

### PR #1: Remove Unused Models (D category, 0 hits)

- **Scope:** 26 models, 0 code changes
- **Risk:** Very low
- **Migration:** Single drop table migration

### PR #2: Remove News Models (D category)

- **Scope:** 6 models, ~50 code references
- **Risk:** Low (news is separate feature)
- **Migration:** Drop tables + remove code

### PR #3: Remove Feature Flag Models (D category)

- **Scope:** 8 models, ~200 code references
- **Risk:** Medium (requires flag service replacement)
- **Migration:** Replace with LaunchDarkly/env vars first

### PR #4: Eject Pipeline State (C category)

- **Scope:** 24 models
- **Risk:** Medium (requires BullMQ setup)
- **Migration:** BullMQ migration + table drops

### PR #5: Split RTL Schema (B category)

- **Scope:** 31 models
- **Risk:** High (new Prisma client)
- **Migration:** Schema split + data migration

### PR #6: Enum Cleanup

- **Scope:** 52 workflow enums
- **Risk:** Medium (data migration)
- **Migration:** enum → varchar with backfill

---

## Success Criteria

| Metric                    | Current | Target |
| ------------------------- | ------- | ------ |
| Schema lines              | 5,822   | ~2,500 |
| Models                    | 200     | ~100   |
| Enums                     | 139     | ~60    |
| Prisma generate time      | ~15s    | ~8s    |
| Migration conflicts/month | 3-5     | 0-1    |
| RTL blocking core deploys | Yes     | No     |

---

## Appendix: Models Per Schema

### Core Schema (99 models)

<details>
<summary>Full list</summary>

Company, User, Transaction, Expense, Account, Document, Contact, Permission, EInvoice, Product, Address, SupportTicket, FiscalRequest, Person, BankTransaction, Statement, Payout, AccountingPeriod, Organization, BankAccount, AuditLog, Employee, Attachment, JournalEntry, StaffAssignment, EInvoiceLine, RecurringExpense, JoppdSubmission, ImportJob, Warehouse, StockMovement, OutboxEvent, Session, ReportingStatus, OperationalEvent, AssetCandidate, CashDayClose, CashIn, ExpenseCategory, PayoutLine, ReferenceTable, JournalLine, FiscalResponse, ExpenseLine, StockItem, Dependent, CashOut, ReviewQueueItem, CompanyUser, RevenueRegisterEntry, Payslip, CalculationSnapshot, RuleVersion, JoppdSubmissionLine, EmailConnection, DepreciationSchedule, DepreciationEntry, CashLimitSetting, Allowance, RuleTable, InvoiceEvent, CertificateNotification, StaffReview, PensionPillar, PaymentDevice, MatchRecord, FixedAsset, VerificationCode, UraInput, TravelPdf, EmployeeRole, EmailImportRule, BankPaymentExport, PostingRule, PayslipArtifact, FiscalCertificate, BusinessPremises, BankPaymentLine, BankConnection, TaxIdentity, ReviewDecision, PersonSnapshot, InvoiceSequence, AccountMapping, PersonEmployeeRole, PersonDirectorRole, PersonContactRole, MileageLog, EmailAttachment, DisposalEvent, ClientInvitation, SupportTicketMessage, StatementPage, PersonEvent, payment_obligation, PasswordResetToken, EmploymentContract, ValuationSnapshot, ExpenseCorrection, eu_transaction, EntitlementHistory, compliance_deadlines, AdminAlert, user_guidance_preferences, SupplierBill, StatementImport, SavedReport, pausalni_profile, eu_vendor, ChartOfAccounts, TrialBalance, notification_preference, newsletter_subscriptions, generated_form, ExportProfile, ExportJob, EmploymentTerminationEvent, EmploymentContractVersion

</details>

### Regulatory Schema (31 models)

<details>
<summary>Full list</summary>

Evidence, Concept, Claim, SourcePointer, RegulatoryRule, AtomicClaim, Artifact, CoverageReport, ComparisonMatrix, RegulatoryAsset, TransitionalProvision, RegulatoryProcess, RuleSnapshot, RegulatoryConflict, GraphEdge, ConceptEmbedding, FactSheet, WatchdogHealth, WatchdogAlert, TruthHealthSnapshot, SourceChunk, ConceptNode, ClaimException, ReferenceEntry, DiscoveryEndpoint, RuleRelease, ProcessStep, RegulatorySource, DiscoveredItem, EvidenceArtifact, ConflictResolutionAudit

</details>
