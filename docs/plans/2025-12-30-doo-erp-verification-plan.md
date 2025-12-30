# D.O.O. Accountant-Grade ERP Verification Plan

**Created:** 2025-12-30
**Purpose:** Verify FiskAI modules against D.O.O. ERP Architecture spec and identify gaps

---

## Executive Summary

FiskAI has **94% feature coverage** with 198 Prisma models and 108 documented features. However, the D.O.O. ERP spec requires verification of **accountant-grade invariants** that go beyond feature presence:

- Immutability after reporting/export
- Period locking enforced at data layer
- Deterministic money (no floats)
- Versioned regulatory rules pinned to calculations
- Complete auditability (who, when, why, before/after)

---

## Module Verification Matrix

### Legend

- **V** = Verify (implementation exists, needs invariant verification)
- **C** = Complete (partial implementation, needs finishing)
- **I** = Implement (missing, needs building)

| #   | Module                    | Status      | Action | Priority |
| --- | ------------------------- | ----------- | ------ | -------- |
| 0   | Platform Core             | Implemented | **V**  | P0       |
| 1   | Master Data               | Implemented | **V**  | P1       |
| 2   | Sales/AR                  | Implemented | **V**  | P0       |
| 3   | Procurement/AP            | Partial     | **C**  | P1       |
| 4   | Banking & Reconciliation  | Implemented | **V**  | P1       |
| 5   | Fiscalization             | Implemented | **V**  | P0       |
| 6   | Regulatory Rules Engine   | Implemented | **V**  | P0       |
| 7   | People & Employment       | Implemented | **V**  | P1       |
| 8   | Payout Engine             | Partial     | **C**  | P0       |
| 9   | JOPPD Reporting           | Implemented | **V**  | P0       |
| 10  | Travel Orders & Mileage   | Implemented | **V**  | P1       |
| 11  | Cash Diary                | Partial     | **C**  | P1       |
| 12  | Fixed Assets              | Implemented | **V**  | P2       |
| 13  | Inventory & Warehouse     | Implemented | **V**  | P2       |
| 14  | General Ledger            | Implemented | **V**  | P0       |
| 15  | VAT & Tax Reporting       | Implemented | **V**  | P0       |
| 16  | Accountant Bridge         | Implemented | **V**  | P1       |
| 17  | Compliance Control Center | Implemented | **V**  | P1       |
| 18  | Administration            | Implemented | **V**  | P2       |

---

## Detailed Verification Tasks

### Module 0: Platform Core

**Location:** `src/lib/auth/`, `src/lib/tenancy/`, `src/lib/audit-query/`

#### Required Invariants (from spec):

- [ ] Every write is attributable (actor + reason)
- [ ] Period locks enforced globally at DB layer
- [ ] All artifacts have checksums

#### Verification Tasks:

```
TASK-0.1: Verify audit log captures before/after state
- Check: prisma-audit-middleware.ts captures field changes
- Check: AuditLog model has before/after JSON fields
- Test: Create/update/delete operations log complete diff

TASK-0.2: Verify period locking enforcement at DB layer
- Check: AccountingPeriod.status blocks writes in services
- Check: Period lock check in prisma middleware (not just UI)
- Test: Attempt to create JournalEntry in locked period → should fail

TASK-0.3: Verify artifact checksums
- Check: All stored PDFs/XMLs have SHA-256 hash
- Check: signedXmlHash field on JOPPD submissions
- Test: Retrieve artifact, verify hash matches content
```

---

### Module 1: Master Data

**Location:** `src/lib/master-data/`, models at lines 806-1015

#### Required Invariants:

- [ ] No duplicate persons per tenant (by OIB)
- [ ] Employee/Contact/Director are roles of Person, not separate entities
- [ ] Person changes create snapshots (versioning)

#### Verification Tasks:

```
TASK-1.1: Verify person deduplication
- Check: Unique constraint on (companyId, oib) for Person
- Check: Import logic detects and merges duplicates
- Test: Attempt to create two persons with same OIB → should fail/merge

TASK-1.2: Verify role separation architecture
- Check: PersonEmployeeRole, PersonContactRole, PersonDirectorRole exist
- Check: No duplicate data between Person and role tables
- Test: Person with multiple roles shares single identity record

TASK-1.3: Verify snapshot versioning
- Check: PersonSnapshot model captures changes
- Check: Service creates snapshot on Person update
- Test: Update person, verify snapshot created with diff
```

---

### Module 2: Sales/AR (Accounts Receivable)

**Location:** `src/lib/invoicing/`, models at lines 1136-1289

#### Required Invariants:

- [ ] Issued invoices are immutable
- [ ] Corrections only via credit note
- [ ] Fiscalized invoices cannot be edited

#### Verification Tasks:

```
TASK-2.1: Verify invoice immutability after issuance
- Check: EInvoice status machine blocks edits after ISSUED
- Check: Service throws on update attempts for non-DRAFT
- Test: Attempt to modify issued invoice → should fail

TASK-2.2: Verify credit note workflow
- Check: Credit note creates new document referencing original
- Check: Original invoice remains unchanged
- Test: Issue credit note, verify original untouched

TASK-2.3: Verify fiscalization lock
- Check: Fiscalized flag prevents any modification
- Check: ZKI/JIR presence blocks invoice editing
- Test: Fiscalize invoice, attempt edit → should fail
```

---

### Module 3: Procurement/AP (Accounts Payable)

**Location:** `src/lib/banking/`, models at lines 1417-1655

#### Required Invariants:

- [ ] Supplier bills linked to expenses
- [ ] Asset candidate detection from expenses

#### Completion Tasks:

```
TASK-3.1: Complete recurring expense implementation
- Status: Model exists (RecurringExpense), service is scaffold
- Action: Implement recurring expense scheduler
- Action: Add cron job for expense generation
- Test: Create recurring rule, verify expenses generated

TASK-3.2: Verify asset candidate detection
- Check: FixedAssetCandidate populated from expenses > threshold
- Check: Threshold configurable per tenant
- Test: Create expense > 3,500 EUR, verify candidate created
```

---

### Module 4: Banking & Reconciliation

**Location:** `src/lib/banking/`, `src/lib/bank-sync/`

#### Required Invariants:

- [ ] Bank imports immutable
- [ ] Matching is additive with audit trail

#### Verification Tasks:

```
TASK-4.1: Verify import immutability
- Check: StatementImport/BankTransaction cannot be modified
- Check: No update endpoints for imported data
- Test: Attempt to modify imported transaction → should fail

TASK-4.2: Verify match audit trail
- Check: MatchRecord has createdBy, createdAt, reason
- Check: Unmatch creates new record (not delete)
- Test: Match/unmatch transaction, verify full history
```

---

### Module 5: Fiscalization

**Location:** `src/lib/fiscal/`

#### Required Invariants:

- [ ] Failed fiscalization blocks invoice issuing
- [ ] Fiscalized documents cannot be edited
- [ ] Certificate lifecycle monitored

#### Verification Tasks:

```
TASK-5.1: Verify fiscalization blocking
- Check: Invoice issuance waits for CRS response
- Check: Failed fiscalization prevents completion
- Test: Simulate CRS failure, verify invoice stays draft

TASK-5.2: Verify certificate monitoring
- Check: CertificateNotification created before expiry
- Check: certificate-monitor.ts runs on schedule
- Test: Create certificate expiring in 30 days, verify alert
```

---

### Module 6: Regulatory Rules Engine

**Location:** `src/lib/regulatory-truth/`, `src/lib/fiscal-rules/`

#### Required Invariants:

- [ ] Calculations pin rule version ID
- [ ] Rules are effective-dated
- [ ] Evidence-backed source pointers

#### Verification Tasks:

```
TASK-6.1: Verify rule version pinning
- Check: PayoutLine.ruleVersionId captures version used
- Check: Calculation snapshots include rule references
- Test: Calculate payroll, verify ruleVersionId populated

TASK-6.2: Verify effective dating
- Check: RuleVersion has effectiveFrom/effectiveTo
- Check: getEffectiveRuleVersion() uses date parameter
- Test: Query rules for past date, verify correct version
```

---

### Module 7: People & Employment

**Location:** `src/lib/people/`

#### Required Invariants:

- [ ] Employment contracts versioned
- [ ] Termination events are immutable

#### Verification Tasks:

```
TASK-7.1: Verify contract versioning
- Check: EmploymentContractVersion created on changes
- Check: Active contract determined by version date
- Test: Modify contract, verify new version created

TASK-7.2: Verify termination immutability
- Check: EmploymentTerminationEvent cannot be deleted
- Check: Only cancellation via new event
- Test: Create termination, attempt delete → should fail
```

---

### Module 8: Payout Engine

**Location:** `src/lib/payroll/`

#### Required Invariants:

- [ ] State machine: Draft → Locked → Reported
- [ ] No edits after lock
- [ ] Calculation snapshots preserved

#### Completion Tasks:

```
TASK-8.1: Implement complete state machine
- Check: Payout.status enum has DRAFT, LOCKED, REPORTED
- Action: Add status transitions with validation
- Action: Block modifications after LOCKED status
- Test: Lock payout, attempt edit → should fail

TASK-8.2: Verify calculation snapshots
- Check: CalculationSnapshot captures gross-to-net breakdown
- Check: Snapshot linked to Payout and PayoutLine
- Test: Run payroll, verify snapshot preserves all inputs

TASK-8.3: Connect to JOPPD
- Check: Every JOPPD line traceable to PayoutLine
- Check: JoppdSubmissionLine.payoutLineId populated
- Test: Generate JOPPD, verify line traceability
```

---

### Module 9: JOPPD Reporting

**Location:** `src/lib/joppd/`

#### Required Invariants:

- [ ] Signed XML immutable
- [ ] Every line traceable to payout
- [ ] Corrections via new submission

#### Verification Tasks:

```
TASK-9.1: Verify XML immutability
- Check: signedXmlStorageKey is read-only after creation
- Check: R2 object has legal hold or retention
- Test: Attempt to modify submitted JOPPD → should fail

TASK-9.2: Verify line traceability
- Check: JoppdSubmissionLine.payoutLineId required
- Check: Query can reconstruct payout → JOPPD path
- Test: Trace JOPPD line back to source payout
```

---

### Module 10: Travel Orders & Mileage

**Location:** `src/lib/travel/`

#### Required Invariants:

- [ ] Travel PDFs immutable after approval
- [ ] Per diem/mileage rules versioned

#### Verification Tasks:

```
TASK-10.1: Verify PDF immutability
- Check: TravelPdf storage key is read-only
- Check: Approved orders cannot be modified
- Test: Approve travel order, attempt modification → should fail

TASK-10.2: Verify rule versioning
- Check: TravelOrder.ruleVersionId populated
- Check: Mileage calculation uses effective rules
- Test: Calculate mileage with old date, verify correct rate
```

---

### Module 11: Cash Diary (Blagajna)

**Location:** `src/lib/cash/`, `src/lib/pos/`

#### Required Invariants:

- [ ] Day close locks entries
- [ ] Cash balance cannot go negative
- [ ] Daily limits enforced

#### Completion Tasks:

```
TASK-11.1: Implement day close locking
- Check: CashDayClose model exists
- Action: Add service to close day and lock entries
- Action: Block modifications to entries before close date
- Test: Close day, attempt to add entry → should fail

TASK-11.2: Implement negative balance prevention
- Action: Add balance check before CashOut
- Action: Calculate running balance on insert
- Test: Attempt CashOut exceeding balance → should fail

TASK-11.3: Implement cash limit enforcement
- Check: CashLimitSetting model exists
- Action: Alert when approaching limit
- Action: Block transactions exceeding limit
- Test: Exceed limit, verify block/alert
```

---

### Module 12: Fixed Assets & Depreciation

**Location:** `src/lib/fixed-assets/`

#### Required Invariants:

- [ ] Depreciation entries are immutable
- [ ] Disposal events create final entry
- [ ] GL integration for depreciation

#### Verification Tasks:

```
TASK-12.1: Verify depreciation immutability
- Check: DepreciationEntry cannot be modified
- Check: Only reversal entries for corrections
- Test: Attempt to edit depreciation entry → should fail

TASK-12.2: Verify GL posting
- Check: DepreciationEntry creates JournalEntry
- Check: Asset disposal creates final GL entries
- Test: Run depreciation, verify GL entries created
```

---

### Module 13: Inventory & Warehouse

**Location:** `src/lib/` (inventory section)

#### Required Invariants:

- [ ] Single valuation method per tenant
- [ ] Stock reconciles with documents
- [ ] Movement history immutable

#### Verification Tasks:

```
TASK-13.1: Verify valuation method lock
- Check: Company.inventoryValuationMethod is set once
- Check: Change requires migration (not casual toggle)
- Test: Attempt to change valuation method → should warn/block

TASK-13.2: Verify stock reconciliation
- Check: StockItem.quantity matches movement sum
- Check: Discrepancy detection in place
- Test: Compare stock to movement history

TASK-13.3: Verify movement immutability
- Check: StockMovement cannot be deleted
- Check: Corrections via reversal movement
- Test: Attempt to delete movement → should fail
```

---

### Module 14: General Ledger (GL)

**Location:** `src/lib/gl/`

#### Required Invariants:

- [ ] All entries must balance (debits = credits)
- [ ] Locked periods immutable
- [ ] Trial balance reproduces from entries

#### Verification Tasks:

```
TASK-14.1: Verify balanced entries enforcement
- Check: JournalEntry save validates balance
- Check: DB constraint or trigger enforces balance
- Test: Attempt unbalanced entry → should fail

TASK-14.2: Verify period lock enforcement
- Check: JournalEntry creation checks period status
- Check: Enforcement at service layer AND prisma middleware
- Test: Create entry in locked period → should fail

TASK-14.3: Verify trial balance reproducibility
- Check: TrialBalance can be recalculated from entries
- Check: Stored vs calculated comparison available
- Test: Generate TB, compare to stored version
```

---

### Module 15: VAT & Tax Reporting

**Location:** `src/lib/vat/`, `src/lib/pausalni/`

#### Required Invariants:

- [ ] PDV return is immutable after submission
- [ ] URA/IRA registers match source documents

#### Verification Tasks:

```
TASK-15.1: Verify PDV immutability
- Check: Submitted PDV return cannot be modified
- Check: Corrections via amendment return
- Test: Submit PDV, attempt modification → should fail

TASK-15.2: Verify register accuracy
- Check: URA sums match expense totals
- Check: IRA sums match invoice totals
- Test: Generate registers, verify totals match sources
```

---

### Module 16: Accountant Bridge & Exports

**Location:** `src/lib/exports/`, `src/lib/reporting/`

#### Required Invariants:

- [ ] Export blocked if mappings missing
- [ ] Control sums mandatory
- [ ] Export artifacts checksummed

#### Verification Tasks:

```
TASK-16.1: Verify mapping validation
- Check: Export fails if AccountMapping incomplete
- Check: Validation report generated
- Test: Attempt export with missing mapping → should fail

TASK-16.2: Verify control sums
- Check: Export includes row counts, total sums
- Check: Receiving system can validate
- Test: Export to Synesis format, verify control sums

TASK-16.3: Verify artifact checksums
- Check: ExportJob stores file hash
- Check: Downloaded file matches hash
- Test: Export, verify hash, re-download and compare
```

---

### Module 17: Compliance Control Center

**Location:** `src/lib/compliance/`, `src/lib/review-queue/`

#### Required Invariants:

- [ ] Review decisions are immutable
- [ ] Approval flows enforced
- [ ] Period locking from this module

#### Verification Tasks:

```
TASK-17.1: Verify decision immutability
- Check: ReviewDecision cannot be deleted
- Check: Overrides create new decision with reason
- Test: Make decision, attempt to modify → should fail

TASK-17.2: Verify period locking integration
- Check: Period lock triggered from compliance dashboard
- Check: Lock affects all modules
- Test: Lock period, verify writes blocked globally
```

---

### Cross-Cutting Verification

#### TASK-X.1: Verify Deterministic Money Handling

```
Purpose: Ensure no floating-point arithmetic for money

Checks:
- [ ] All money fields are Decimal in Prisma schema
- [ ] No parseFloat() on money values in services
- [ ] Rounding uses banker's rounding (HALF_EVEN)
- [ ] Currency conversion uses fixed-point math

Files to audit:
- src/lib/payroll/*.ts
- src/lib/invoicing/*.ts
- src/lib/vat/*.ts
- src/lib/gl/*.ts

Test: Calculate payroll with edge-case amounts, verify no precision loss
```

#### TASK-X.2: Verify Complete Audit Trail

```
Purpose: Every write attributable with who/when/why/before/after

Checks:
- [ ] prisma-audit-middleware captures all changes
- [ ] AuditLog includes userId, reason, before, after
- [ ] No direct SQL bypassing middleware
- [ ] Batch operations logged individually

Test: Perform operations, query audit log, verify complete trail
```

#### TASK-X.3: Verify Period Locking Scope

```
Purpose: Period lock affects ALL modules

Modules that must respect period lock:
- [ ] JournalEntry (GL)
- [ ] EInvoice (Sales)
- [ ] Expense (Procurement)
- [ ] BankTransaction matching
- [ ] DepreciationEntry
- [ ] CashIn/CashOut
- [ ] Payout/PayoutLine

Test: Lock period, attempt writes in each module, verify all blocked
```

---

## Implementation Priority

### P0 - Critical (Week 1-2)

1. Platform Core audit verification
2. Sales/AR immutability verification
3. Payout Engine state machine completion
4. GL balanced entry enforcement
5. Fiscalization blocking verification
6. VAT reporting immutability

### P1 - High (Week 3-4)

1. Master Data deduplication verification
2. Procurement recurring expense completion
3. Banking reconciliation audit trail
4. People & Employment versioning
5. Travel Orders immutability
6. Accountant Bridge validation

### P2 - Medium (Week 5-6)

1. Cash Diary day close implementation
2. Fixed Assets GL integration
3. Inventory valuation lock
4. Compliance Control Center polish
5. Cross-cutting money handling audit
6. Complete audit trail verification

---

## Success Criteria

FiskAI is "D.O.O. Accountant-Grade" when:

1. **Zero data loss risk** - All mutations audited, all artifacts checksummed
2. **Regulatory defensibility** - Every calculation traceable to rule version
3. **Period integrity** - Locked periods are truly immutable across all modules
4. **Accountant trust** - Exports have control sums, reports are reproducible
5. **User confidence** - Clear state machines, no surprise edits

---

## Next Steps

1. Review this plan with stakeholders
2. Create GitHub issues for each TASK
3. Prioritize based on D.O.O. client needs
4. Execute P0 tasks first
5. Run verification test suites
6. Document compliance in audit reports
