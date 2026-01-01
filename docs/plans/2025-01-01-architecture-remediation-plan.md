# FiskAI Architecture Remediation Plan

**Date:** 2025-01-01
**Author:** Principal Systems Architect (AI Audit)
**Status:** APPROVED FOR EXECUTION
**Scope:** Complete end-to-end architectural remediation

---

## 1. Executive Verdict

FiskAI is **architecturally unsound for a regulated financial system**. The codebase exhibits:

- **Zero domain layer separation**: 81 flat modules in `src/lib/` with no dependency boundaries
- **Pervasive infrastructure leakage**: 252 files import `db` directly, including 13 UI components
- **Dangerous money handling**: 307 float-based operations vs 106 Decimal uses (3:1 ratio of unsafe to safe)
- **Validation collapse**: 81% of API routes lack Zod validation
- **Non-blocking type safety**: TypeScript errors do not fail CI
- **Anemic domain models**: `src/lib/invoicing/models.ts` is 4 lines of Prisma type aliases
- **No true domain events**: `emitInvoiceEvent()` is a DB write, not an event

This is not a "needs improvement" situation. This is a **structural failure** that requires systematic remediation before the system can be considered production-safe for financial/compliance workloads.

---

## 2. Current State vs Target State

| Dimension            | Current State                                              | Target State                                                                           | Gap Severity |
| -------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------ |
| **Architecture**     | Flat `src/lib/` (81 modules), no layers                    | `domain/` → `application/` → `infrastructure/` → `interfaces/` with ESLint enforcement | CRITICAL     |
| **Domain Models**    | Prisma type aliases, anemic                                | Rich aggregates with business methods, invariants                                      | CRITICAL     |
| **Money Handling**   | 307 `parseFloat`/`Number()`/`.toFixed()` in business logic | Pure `Money` value object, zero floats in domain                                       | CRITICAL     |
| **Validation**       | 18.7% Zod coverage, 49 routes manual                       | 100% Zod at boundaries, standardized helpers                                           | HIGH         |
| **Async Safety**     | No ESLint rules, swallowed errors                          | `no-floating-promises`, `no-misused-promises` enforced                                 | HIGH         |
| **State Machines**   | Implicit status enums                                      | Explicit transitions with guards, idempotency keys                                     | HIGH         |
| **Tests**            | 34k lines, integration disabled in CI                      | Unit + integration + E2E + property + golden, all in CI                                | HIGH         |
| **CI Gates**         | TypeScript non-blocking                                    | All gates blocking, progressive enforcement                                            | CRITICAL     |
| **Domain Events**    | DB writes masquerading as events                           | True domain events for audit + async flows                                             | MEDIUM       |
| **Bounded Contexts** | Implicit, cross-cutting                                    | 7 explicit contexts with ownership boundaries                                          | MEDIUM       |

---

## 3. Evidence-Based Violations

### 3.1 Architecture Violations

**No Domain Layer Exists**

```
src/
├── app/          # Routes + server actions (mixed concerns)
├── components/   # UI (some import db directly)
├── lib/          # 81 modules, flat, no separation
└── __tests__/    # Tests
```

Target structure does not exist:

- `src/domain/` — Does not exist
- `src/application/` — Does not exist
- `src/infrastructure/` — Does not exist
- `src/interfaces/` — Does not exist

**Direct DB Imports (252 files)**

```bash
$ grep -r "from \"@/lib/db\"" src | wc -l
252
```

Examples in UI components (FORBIDDEN):

- `src/components/admin/dashboard.tsx`
- `src/components/admin/staff-management.tsx`
- `src/components/staff/calendar.tsx`
- `src/components/staff/dashboard.tsx`
- `src/components/staff/clients-list.tsx`
- `src/components/staff/tasks-list.tsx`
- `src/components/staff/tickets-list.tsx`
- `src/components/staff/invitations-list.tsx`
- `src/components/admin/tenants-list.tsx`
- `src/components/admin/support-dashboard.tsx`
- `src/components/admin/header-wrapper.tsx`
- `src/components/layout/header.tsx`

**Upward Import Violations**

```typescript
// src/lib/pos/offline-queue.ts - lib imports from app
import { ... } from "@/app/(app)/pos/types"

// src/lib/pos/use-offline-pos.ts - lib imports from app
import { ... } from "@/app/actions/pos"

// src/lib/visibility/components.tsx - lib imports from components
import { Button } from "@/components/ui/button"
```

### 3.2 Anemic Domain Models

**src/lib/invoicing/models.ts (Complete File)**

```typescript
import type { EInvoice, EInvoiceLine, InvoiceSequence } from "@prisma/client"

export type Invoice = EInvoice
export type InvoiceLine = EInvoiceLine
export type NumberingSequence = InvoiceSequence
export type CreditNote = EInvoice & { type: "CREDIT_NOTE" }
```

This is not a domain model. This is a type alias. There are:

- No business methods (`issue()`, `fiscalize()`, `pay()`)
- No invariant enforcement
- No state transition guards
- No value objects

### 3.3 Money Handling Violations

**Dangerous Float Operations: 307 instances**

```typescript
// src/lib/fiscal-rules/service.ts:122-174 — VAT CALCULATION
const vatAmount = Number((input.netAmount * selectedRate.rate).toFixed(2))
const grossAmount = Number((input.netAmount + vatAmount).toFixed(2))
const surtaxAmount = Number((input.baseTax * entry.prirezRate).toFixed(2))
const totalTax = Number((input.baseTax + surtaxAmount).toFixed(2))
const mioI = Number((clampedBase * data.rates.MIO_I.rate).toFixed(2))
const mioII = Number((clampedBase * data.rates.MIO_II.rate).toFixed(2))
const hzzo = Number((clampedBase * data.rates.HZZO.rate).toFixed(2))
const total = Number((mioI + mioII + hzzo).toFixed(2))
```

```typescript
// src/lib/reports/pdv-xml-generator.ts:150-171 — VAT REPORT
net: invoices.reduce((sum, i) => sum + Number(i.netAmount), 0),
vat: invoices.reduce((sum, i) => sum + Number(i.vatAmount), 0),
total: invoices.reduce((sum, i) => sum + Number(i.totalAmount), 0),
// Accumulates rounding errors across 1000+ invoices
```

```typescript
// src/lib/banking/import/processor.ts:31-39 — BANK IMPORT
function parseCroatianNumber(raw: string): number {
  const cleaned = str.replace(/\./g, "").replace(/,/g, ".")
  if (cleaned.endsWith("-")) {
    return parseFloat(cleaned.slice(0, -1)) * -1
  }
  return parseFloat(cleaned)
}
```

```typescript
// src/app/(app)/expenses/new/expense-form.tsx:66-68 — CLIENT VAT
const net = parseFloat(netAmount) || 0
const vat = net * (parseFloat(vatRate) / 100)
const total = net + vat
```

**No Money Value Object**

There is no `Money` class, no `VatRate` value object, no `Quantity` value object. All money is either:

- `Prisma.Decimal` (DB layer)
- `number` (business logic — WRONG)

### 3.4 Validation Violations

**API Route Coverage: 18.7%**

| Metric                        | Count        |
| ----------------------------- | ------------ |
| Total API routes              | 235          |
| Routes with Zod               | 44 (18.7%)   |
| Routes with manual validation | 49 (20.8%)   |
| Routes with no validation     | ~142 (60.4%) |

**Critical Unvalidated Routes:**

```typescript
// src/app/api/admin/staff/route.ts — ROLE CHANGES
const body = await request.json()
const { email, confirmationToken, reason } = body
if (!email || typeof email !== "string") { ... }
// Manual validation for admin operation
```

```typescript
// src/app/api/backup/restore/route.ts — DATA RESTORE
const validation = validateBackupData(backupData)
// Custom validator, not Zod
```

```typescript
// src/app/api/bank/refresh/route.ts — BANK SYNC
const { bankAccountId } = await request.json()
if (!bankAccountId) {
  return error
}
// No type/format validation
```

### 3.5 Async Safety Violations

**.eslintrc.json — MISSING RULES**

```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn"
    // no-floating-promises: NOT CONFIGURED
    // no-misused-promises: NOT CONFIGURED
  }
}
```

**Swallowed Errors:**

```typescript
// src/lib/assistant/reasoning/shadow-runner.ts:26
runNewPipelineInBackground(...).catch((error) => {
  // Fire-and-forget, error logged but not propagated
})

// src/lib/assistant/reasoning/sinks/consumer.ts:28
writeResult.catch((err) => {
  // Swallowed
})
```

### 3.6 CI Gate Violations

**.github/workflows/ci.yml — NON-BLOCKING TYPECHECK**

```yaml
typecheck:
  name: TypeScript Check
  runs-on: ubuntu-latest
  continue-on-error: true # DOES NOT BLOCK MERGES
```

**Current TypeScript Errors: 113**

```bash
$ npx tsc --noEmit 2>&1 | grep "error TS" | wc -l
113
```

**Integration Tests Disabled:**

```yaml
test-integration:
  if: false # DISABLED
```

### 3.7 State Machine Violations

**No Explicit State Machines**

Fiscalization has implicit states via `EInvoiceStatus` enum:

```
DRAFT → PENDING_FISCALIZATION → FISCALIZED → SENT → DELIVERED → ACCEPTED
```

But there are:

- No transition guards in domain
- No invalid transition prevention
- State changes via direct DB updates

```typescript
// src/app/actions/fiscalize.ts:196
await db.eInvoice.update({
  where: { id: invoiceId },
  data: {
    status: "FISCALIZED",
    fiscalizedAt: new Date(),
  },
})
// Direct DB update, no aggregate, no guard
```

### 3.8 Idempotency Violations

**Partial Implementation:**

```typescript
// src/lib/fiscal/should-fiscalize.ts:42-52 — EXISTS
const existingRequest = await db.fiscalRequest.findFirst({
  where: {
    invoiceId: invoice.id,
    messageType: "RACUN",
    status: { in: ["QUEUED", "PROCESSING"] },
  },
})
```

But not systematic:

- No idempotency keys on imports
- No idempotency on expense creation
- No idempotency on bank reconciliation matches

---

## 4. Full End-to-End Remediation Plan

### Phase 0: Containment (Week 1)

**Purpose:** Stop the bleeding. Make CI gates blocking. Prevent new violations.

#### Actions

1. **Make TypeScript blocking**
   - File: `.github/workflows/ci.yml`
   - Remove `continue-on-error: true` from typecheck job
   - Add `needs: [typecheck]` to build job

2. **Fix remaining 113 TypeScript errors**
   - Create branch: `fix/typescript-blocking`
   - Resolve all errors
   - PR and merge

3. **Enable integration tests**
   - File: `.github/workflows/ci.yml`
   - Remove `if: false` from test-integration job
   - Fix Prisma 7 config for CI migrations

4. **Add async lint rules**
   - File: `.eslintrc.json`
   - Add rules (initially as warnings):
     ```json
     "@typescript-eslint/no-floating-promises": "warn",
     "@typescript-eslint/no-misused-promises": "warn"
     ```

5. **Block new DB imports in components**
   - File: `.eslintrc.json`
   - Add rule:
     ```json
     "no-restricted-imports": ["error", {
       "paths": [{
         "name": "@/lib/db",
         "message": "Components must not import db. Use server actions."
       }]
     }]
     ```
   - Apply to: `src/components/**/*`

#### Success Criteria

- [ ] All PRs require passing TypeScript
- [ ] Integration tests run on every PR
- [ ] No new component files can import `@/lib/db`
- [ ] Async lint warnings appear in PR checks

---

### Phase 1: Pure Domain Primitives (Week 2-3)

**Purpose:** Create the foundational building blocks for domain logic.

#### Actions

1. **Create Money value object**

   File: `src/domain/shared/Money.ts`

   ```typescript
   import Decimal from "decimal.js"

   export class Money {
     private constructor(
       private readonly amount: Decimal,
       public readonly currency: string
     ) {
       if (amount.isNaN()) throw new Error("Invalid money amount")
     }

     static fromDecimal(amount: Decimal, currency: string = "EUR"): Money {
       return new Money(amount, currency)
     }

     static fromCents(cents: number, currency: string = "EUR"): Money {
       return new Money(new Decimal(cents).div(100), currency)
     }

     static fromString(amount: string, currency: string = "EUR"): Money {
       return new Money(new Decimal(amount), currency)
     }

     static zero(currency: string = "EUR"): Money {
       return new Money(new Decimal(0), currency)
     }

     add(other: Money): Money {
       this.assertSameCurrency(other)
       return new Money(this.amount.add(other.amount), this.currency)
     }

     subtract(other: Money): Money {
       this.assertSameCurrency(other)
       return new Money(this.amount.sub(other.amount), this.currency)
     }

     multiply(factor: Decimal | number): Money {
       const f = factor instanceof Decimal ? factor : new Decimal(factor)
       return new Money(this.amount.mul(f), this.currency)
     }

     divide(divisor: Decimal | number): Money {
       const d = divisor instanceof Decimal ? divisor : new Decimal(divisor)
       return new Money(this.amount.div(d), this.currency)
     }

     round(decimals: number = 2): Money {
       return new Money(this.amount.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP), this.currency)
     }

     isPositive(): boolean {
       return this.amount.gt(0)
     }
     isNegative(): boolean {
       return this.amount.lt(0)
     }
     isZero(): boolean {
       return this.amount.isZero()
     }

     equals(other: Money): boolean {
       return this.currency === other.currency && this.amount.eq(other.amount)
     }

     toDecimal(): Decimal {
       return this.amount
     }
     toCents(): number {
       return this.amount.mul(100).toNumber()
     }

     // ONLY place for formatting
     format(locale: string = "hr-HR"): string {
       return new Intl.NumberFormat(locale, {
         style: "currency",
         currency: this.currency,
       }).format(this.amount.toNumber())
     }

     private assertSameCurrency(other: Money): void {
       if (this.currency !== other.currency) {
         throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`)
       }
     }
   }
   ```

2. **Create VatRate value object**

   File: `src/domain/shared/VatRate.ts`

   ```typescript
   import Decimal from "decimal.js"
   import { Money } from "./Money"

   export class VatRate {
     private constructor(
       public readonly rate: Decimal,
       public readonly code: string
     ) {
       if (rate.lt(0) || rate.gt(100)) {
         throw new Error(`Invalid VAT rate: ${rate}`)
       }
     }

     static fromPercentage(rate: number, code: string = "STANDARD"): VatRate {
       return new VatRate(new Decimal(rate), code)
     }

     static readonly ZERO = new VatRate(new Decimal(0), "ZERO")
     static readonly REDUCED_5 = new VatRate(new Decimal(5), "REDUCED_5")
     static readonly REDUCED_13 = new VatRate(new Decimal(13), "REDUCED_13")
     static readonly STANDARD_25 = new VatRate(new Decimal(25), "STANDARD")

     calculateVat(netAmount: Money): Money {
       return netAmount.multiply(this.rate.div(100)).round(2)
     }

     calculateGross(netAmount: Money): Money {
       const vat = this.calculateVat(netAmount)
       return netAmount.add(vat)
     }

     equals(other: VatRate): boolean {
       return this.rate.eq(other.rate) && this.code === other.code
     }
   }
   ```

3. **Create Quantity value object**

   File: `src/domain/shared/Quantity.ts`

   ```typescript
   import Decimal from "decimal.js"

   export class Quantity {
     private constructor(
       private readonly value: Decimal,
       public readonly unit: string = "PCE"
     ) {
       if (value.isNaN()) throw new Error("Invalid quantity")
     }

     static of(value: number | string | Decimal, unit: string = "PCE"): Quantity {
       const v = value instanceof Decimal ? value : new Decimal(value)
       return new Quantity(v, unit)
     }

     multiply(factor: Decimal | number): Quantity {
       const f = factor instanceof Decimal ? factor : new Decimal(factor)
       return new Quantity(this.value.mul(f), this.unit)
     }

     toDecimal(): Decimal {
       return this.value
     }
     toNumber(): number {
       return this.value.toNumber()
     }

     isPositive(): boolean {
       return this.value.gt(0)
     }
     isZero(): boolean {
       return this.value.isZero()
     }
   }
   ```

4. **Create domain layer structure**

   ```
   src/domain/
   ├── shared/
   │   ├── Money.ts
   │   ├── VatRate.ts
   │   ├── Quantity.ts
   │   ├── EntityId.ts
   │   └── index.ts
   ├── invoicing/           # Phase 2
   ├── fiscalization/       # Phase 3
   ├── tax/                 # Phase 3
   ├── banking/             # Phase 4
   ├── compliance/          # Phase 5
   └── identity/            # Phase 5
   ```

5. **Add ESLint rule to ban floats in domain**

   File: `eslint-rules/no-float-money.js`

   ```javascript
   module.exports = {
     meta: {
       type: "problem",
       docs: { description: "Disallow parseFloat/Number()/toFixed() in domain layer" },
     },
     create(context) {
       return {
         CallExpression(node) {
           if (node.callee.name === "parseFloat") {
             context.report({ node, message: "Use Money.fromString() instead of parseFloat" })
           }
           if (node.callee.object?.name === "Number" && !node.callee.property) {
             context.report({ node, message: "Use Money value object instead of Number()" })
           }
         },
         MemberExpression(node) {
           if (node.property.name === "toFixed") {
             context.report({ node, message: "Use Money.round() instead of toFixed()" })
           }
         },
       }
     },
   }
   ```

   Apply to: `src/domain/**/*`

#### Success Criteria

- [ ] `Money`, `VatRate`, `Quantity` value objects exist with tests
- [ ] ESLint blocks floats in `src/domain/`
- [ ] 100% test coverage on value objects
- [ ] Property-based tests for Money arithmetic (fast-check)

---

### Phase 2: Invoice Aggregate (Week 4-6)

**Purpose:** Create the first complete bounded context with rich domain model.

#### Actions

1. **Create Invoice aggregate root**

   File: `src/domain/invoicing/Invoice.ts`

   ```typescript
   import { Money, VatRate, Quantity } from "../shared"
   import { InvoiceLine } from "./InvoiceLine"
   import { InvoiceStatus } from "./InvoiceStatus"
   import { InvoiceIssued, InvoiceFiscalized } from "./events"

   export class Invoice {
     private readonly lines: InvoiceLine[] = []
     private status: InvoiceStatus = InvoiceStatus.DRAFT
     private issuedAt: Date | null = null
     private fiscalizedAt: Date | null = null
     private jir: string | null = null
     private zki: string | null = null

     private constructor(
       public readonly id: string,
       public readonly companyId: string,
       public readonly invoiceNumber: string,
       public readonly currency: string
     ) {}

     static create(
       id: string,
       companyId: string,
       invoiceNumber: string,
       currency: string = "EUR"
     ): Invoice {
       return new Invoice(id, companyId, invoiceNumber, currency)
     }

     // ========== BUSINESS METHODS ==========

     addLine(description: string, quantity: Quantity, unitPrice: Money, vatRate: VatRate): void {
       this.assertDraft("Cannot add line to non-draft invoice")

       const lineNumber = this.lines.length + 1
       const line = InvoiceLine.create(lineNumber, description, quantity, unitPrice, vatRate)
       this.lines.push(line)
     }

     removeLine(lineNumber: number): void {
       this.assertDraft("Cannot remove line from non-draft invoice")

       const index = this.lines.findIndex((l) => l.lineNumber === lineNumber)
       if (index === -1) throw new Error(`Line ${lineNumber} not found`)

       this.lines.splice(index, 1)
       // Renumber remaining lines
       this.lines.forEach((line, i) => line.renumber(i + 1))
     }

     issue(): InvoiceIssued {
       this.assertDraft("Invoice already issued")
       if (this.lines.length === 0) {
         throw new Error("Cannot issue empty invoice")
       }

       this.status = InvoiceStatus.ISSUED
       this.issuedAt = new Date()

       return new InvoiceIssued(
         this.id,
         this.companyId,
         this.invoiceNumber,
         this.netAmount,
         this.vatAmount,
         this.totalAmount,
         this.issuedAt
       )
     }

     markFiscalized(jir: string, zki: string): InvoiceFiscalized {
       if (
         this.status !== InvoiceStatus.ISSUED &&
         this.status !== InvoiceStatus.PENDING_FISCALIZATION
       ) {
         throw new Error(`Cannot fiscalize invoice in status ${this.status}`)
       }
       if (this.jir) {
         throw new Error("Invoice already fiscalized")
       }

       this.status = InvoiceStatus.FISCALIZED
       this.fiscalizedAt = new Date()
       this.jir = jir
       this.zki = zki

       return new InvoiceFiscalized(this.id, this.companyId, jir, zki, this.fiscalizedAt)
     }

     // ========== CALCULATED PROPERTIES ==========

     get netAmount(): Money {
       return this.lines.reduce((sum, line) => sum.add(line.netAmount), Money.zero(this.currency))
     }

     get vatAmount(): Money {
       return this.lines.reduce((sum, line) => sum.add(line.vatAmount), Money.zero(this.currency))
     }

     get totalAmount(): Money {
       return this.netAmount.add(this.vatAmount)
     }

     get lineCount(): number {
       return this.lines.length
     }

     getLines(): ReadonlyArray<InvoiceLine> {
       return [...this.lines]
     }

     // ========== GUARDS ==========

     private assertDraft(message: string): void {
       if (this.status !== InvoiceStatus.DRAFT) {
         throw new Error(message)
       }
     }
   }
   ```

2. **Create InvoiceLine entity**

   File: `src/domain/invoicing/InvoiceLine.ts`

   ```typescript
   import { Money, VatRate, Quantity } from "../shared"

   export class InvoiceLine {
     private _lineNumber: number

     private constructor(
       lineNumber: number,
       public readonly description: string,
       public readonly quantity: Quantity,
       public readonly unitPrice: Money,
       public readonly vatRate: VatRate
     ) {
       this._lineNumber = lineNumber
       if (!quantity.isPositive()) {
         throw new Error("Quantity must be positive")
       }
     }

     static create(
       lineNumber: number,
       description: string,
       quantity: Quantity,
       unitPrice: Money,
       vatRate: VatRate
     ): InvoiceLine {
       return new InvoiceLine(lineNumber, description, quantity, unitPrice, vatRate)
     }

     get lineNumber(): number {
       return this._lineNumber
     }

     get netAmount(): Money {
       return this.unitPrice.multiply(this.quantity.toDecimal()).round(2)
     }

     get vatAmount(): Money {
       return this.vatRate.calculateVat(this.netAmount)
     }

     get grossAmount(): Money {
       return this.netAmount.add(this.vatAmount)
     }

     renumber(newNumber: number): void {
       this._lineNumber = newNumber
     }
   }
   ```

3. **Create domain events**

   File: `src/domain/invoicing/events/InvoiceIssued.ts`

   ```typescript
   import { Money } from "../../shared"

   export class InvoiceIssued {
     public readonly occurredAt = new Date()

     constructor(
       public readonly invoiceId: string,
       public readonly companyId: string,
       public readonly invoiceNumber: string,
       public readonly netAmount: Money,
       public readonly vatAmount: Money,
       public readonly totalAmount: Money,
       public readonly issuedAt: Date
     ) {}
   }
   ```

4. **Create repository interface (port)**

   File: `src/domain/invoicing/InvoiceRepository.ts`

   ```typescript
   import { Invoice } from "./Invoice"

   export interface InvoiceRepository {
     findById(id: string): Promise<Invoice | null>
     findByNumber(companyId: string, invoiceNumber: string): Promise<Invoice | null>
     save(invoice: Invoice): Promise<void>
     nextInvoiceNumber(companyId: string): Promise<string>
   }
   ```

5. **Create use cases (application layer)**

   File: `src/application/invoicing/CreateInvoiceUseCase.ts`

   ```typescript
   import { Invoice, InvoiceRepository } from "@/domain/invoicing"
   import { Money, VatRate, Quantity } from "@/domain/shared"

   interface CreateInvoiceInput {
     companyId: string
     lines: Array<{
       description: string
       quantity: number
       unitPrice: string
       vatRate: number
     }>
     currency?: string
   }

   interface CreateInvoiceOutput {
     invoiceId: string
     invoiceNumber: string
   }

   export class CreateInvoiceUseCase {
     constructor(private readonly invoiceRepository: InvoiceRepository) {}

     async execute(input: CreateInvoiceInput): Promise<CreateInvoiceOutput> {
       const invoiceNumber = await this.invoiceRepository.nextInvoiceNumber(input.companyId)
       const id = crypto.randomUUID()

       const invoice = Invoice.create(id, input.companyId, invoiceNumber, input.currency ?? "EUR")

       for (const line of input.lines) {
         invoice.addLine(
           line.description,
           Quantity.of(line.quantity),
           Money.fromString(line.unitPrice, input.currency ?? "EUR"),
           VatRate.fromPercentage(line.vatRate)
         )
       }

       await this.invoiceRepository.save(invoice)

       return { invoiceId: id, invoiceNumber }
     }
   }
   ```

6. **Create Prisma repository (infrastructure)**

   File: `src/infrastructure/invoicing/PrismaInvoiceRepository.ts`

   ```typescript
   import { db } from "@/lib/db"
   import { Invoice, InvoiceRepository, InvoiceLine } from "@/domain/invoicing"
   import { Money, VatRate, Quantity } from "@/domain/shared"
   import { Prisma } from "@prisma/client"

   export class PrismaInvoiceRepository implements InvoiceRepository {
     async findById(id: string): Promise<Invoice | null> {
       const record = await db.eInvoice.findUnique({
         where: { id },
         include: { lines: true },
       })

       if (!record) return null
       return this.toDomain(record)
     }

     async save(invoice: Invoice): Promise<void> {
       const data = this.toPersistence(invoice)

       await db.eInvoice.upsert({
         where: { id: invoice.id },
         create: data,
         update: data,
       })
     }

     async nextInvoiceNumber(companyId: string): Promise<string> {
       // Implement sequence logic
     }

     private toDomain(record: any): Invoice {
       // Map DB record → Domain aggregate
       const invoice = Invoice.create(
         record.id,
         record.companyId,
         record.invoiceNumber,
         record.currency
       )

       for (const line of record.lines) {
         invoice.addLine(
           line.description,
           Quantity.of(line.quantity.toString()),
           Money.fromDecimal(line.unitPrice, record.currency),
           VatRate.fromPercentage(line.vatRate.toNumber())
         )
       }

       return invoice
     }

     private toPersistence(invoice: Invoice): any {
       // Map Domain aggregate → DB record
       return {
         id: invoice.id,
         companyId: invoice.companyId,
         invoiceNumber: invoice.invoiceNumber,
         currency: invoice.currency,
         netAmount: new Prisma.Decimal(invoice.netAmount.toDecimal().toString()),
         vatAmount: new Prisma.Decimal(invoice.vatAmount.toDecimal().toString()),
         totalAmount: new Prisma.Decimal(invoice.totalAmount.toDecimal().toString()),
         lines: {
           upsert: invoice.getLines().map((line) => ({
             where: {
               invoiceId_lineNumber: { invoiceId: invoice.id, lineNumber: line.lineNumber },
             },
             create: this.lineToPersistence(invoice.id, line),
             update: this.lineToPersistence(invoice.id, line),
           })),
         },
       }
     }
   }
   ```

7. **Create API adapter (interfaces)**

   File: `src/interfaces/api/invoices/route.ts`

   ```typescript
   import { NextResponse } from "next/server"
   import { z } from "zod"
   import { CreateInvoiceUseCase } from "@/application/invoicing"
   import { PrismaInvoiceRepository } from "@/infrastructure/invoicing"
   import { parseBody } from "@/lib/api/validation"
   import { requireAuth } from "@/lib/auth-utils"

   const createInvoiceSchema = z.object({
     lines: z
       .array(
         z.object({
           description: z.string().min(1),
           quantity: z.number().positive(),
           unitPrice: z.string(),
           vatRate: z.number().min(0).max(100),
         })
       )
       .min(1),
     currency: z.string().length(3).optional(),
   })

   export async function POST(request: Request) {
     const user = await requireAuth()
     const input = await parseBody(request, createInvoiceSchema)

     const repository = new PrismaInvoiceRepository()
     const useCase = new CreateInvoiceUseCase(repository)

     const result = await useCase.execute({
       companyId: user.companyId,
       ...input,
     })

     return NextResponse.json(result, { status: 201 })
   }
   ```

8. **Add ESLint layer boundaries**

   File: `.eslintrc.json`

   ```json
   {
     "rules": {
       "import/no-restricted-paths": [
         "error",
         {
           "zones": [
             {
               "target": "src/domain/**/*",
               "from": [
                 "src/application/**/*",
                 "src/infrastructure/**/*",
                 "src/interfaces/**/*",
                 "src/lib/**/*",
                 "src/app/**/*"
               ],
               "message": "Domain layer must not import from outer layers"
             },
             {
               "target": "src/application/**/*",
               "from": ["src/interfaces/**/*", "src/app/**/*"],
               "message": "Application layer must not import from interfaces"
             }
           ]
         }
       ]
     }
   }
   ```

#### Success Criteria

- [ ] Invoice aggregate with `addLine()`, `issue()`, `markFiscalized()`
- [ ] InvoiceLine entity with calculated properties
- [ ] InvoiceRepository interface + Prisma implementation
- [ ] CreateInvoiceUseCase orchestrating domain
- [ ] ESLint blocking cross-layer imports
- [ ] Unit tests for aggregate invariants
- [ ] Property tests for money calculations

---

### Phase 3: Fiscalization & Tax Contexts (Week 7-9)

**Purpose:** Extract fiscalization state machine and tax calculation into domain.

#### Actions

1. **Create FiscalizationRequest aggregate**

   File: `src/domain/fiscalization/FiscalizationRequest.ts`
   - State machine: `QUEUED` → `PROCESSING` → `COMPLETED` | `FAILED`
   - Idempotency key enforcement
   - Retry logic as domain concept

2. **Create VatCalculator domain service**

   File: `src/domain/tax/VatCalculator.ts`
   - Pure calculation logic
   - No DB, no Prisma
   - Uses Money and VatRate value objects

3. **Migrate fiscal-rules/service.ts calculations**
   - Replace all `Number((...).toFixed(2))` with Money operations
   - Move pure logic to domain

4. **Create ZKI generator as domain service**
   - Currently in `src/lib/fiscal/xml-builder.ts`
   - Move calculation to `src/domain/fiscalization/ZkiGenerator.ts`

#### Success Criteria

- [ ] FiscalizationRequest with explicit states
- [ ] VatCalculator with zero float operations
- [ ] Golden tests for ZKI generation
- [ ] Property tests for VAT calculations

---

### Phase 4: Banking & Reconciliation (Week 10-11)

**Purpose:** Extract banking domain with proper money handling.

#### Actions

1. **Create BankTransaction aggregate**
2. **Create ReconciliationMatch value object**
3. **Migrate banking/import/processor.ts**
   - Replace `parseFloat(cleaned)` with Money parsing
   - Add validation for imported amounts
4. **Create bank statement parser as infrastructure**
   - Parsing is infrastructure (external format)
   - Validation and business rules in domain

#### Success Criteria

- [ ] BankTransaction with proper Money types
- [ ] Import parser returns domain objects, not numbers
- [ ] Reconciliation uses Money comparison (not float tolerance)

---

### Phase 5: Compliance & Identity (Week 12-13)

**Purpose:** Complete bounded context extraction.

#### Actions

1. **Create Deadline aggregate** (Compliance)
2. **Create Tenant aggregate** (Identity)
3. **Create StaffAssignment entity** (Identity)
4. **Define context boundaries**

#### Success Criteria

- [ ] All 7 bounded contexts have domain layer
- [ ] Clear ownership of each concept

---

### Phase 6: Validation Hardening (Week 14)

**Purpose:** 100% Zod coverage at boundaries.

#### Actions

1. **Create validation helpers**

   File: `src/lib/api/validation.ts`

   ```typescript
   import { z } from "zod"
   import { NextResponse } from "next/server"

   export async function parseBody<T extends z.ZodType>(
     request: Request,
     schema: T
   ): Promise<z.infer<T>> {
     const body = await request.json()
     const result = schema.safeParse(body)

     if (!result.success) {
       throw new ValidationError(result.error.flatten())
     }

     return result.data
   }

   export function parseQuery<T extends z.ZodType>(
     searchParams: URLSearchParams,
     schema: T
   ): z.infer<T> {
     const params = Object.fromEntries(searchParams.entries())
     const result = schema.safeParse(params)

     if (!result.success) {
       throw new ValidationError(result.error.flatten())
     }

     return result.data
   }
   ```

2. **Migrate all 49 manually-validated routes**
3. **Migrate all 142 unvalidated routes**

#### Success Criteria

- [ ] 100% of routes use Zod
- [ ] Consistent error format
- [ ] ESLint rule requiring validation

---

### Phase 7: Testing & CI Hardening (Week 15-16)

**Purpose:** Make tests prove correctness.

#### Actions

1. **Add fast-check property tests**

   ```typescript
   import * as fc from "fast-check"

   describe("Money invariants", () => {
     it("a + b - b = a", () => {
       fc.assert(
         fc.property(
           fc.integer({ min: 0, max: 1_000_000_00 }),
           fc.integer({ min: 0, max: 1_000_000_00 }),
           (aCents, bCents) => {
             const a = Money.fromCents(aCents)
             const b = Money.fromCents(bCents)
             expect(a.add(b).subtract(b).equals(a)).toBe(true)
           }
         )
       )
     })

     it("sum of lines equals totals", () => {
       fc.assert(
         fc.property(
           fc.array(
             fc.record({
               quantity: fc.integer({ min: 1, max: 100 }),
               unitPriceCents: fc.integer({ min: 1, max: 100_000_00 }),
               vatRate: fc.constantFrom(0, 5, 13, 25),
             }),
             { minLength: 1, maxLength: 20 }
           ),
           (lines) => {
             const invoice = Invoice.create("1", "c", "INV-1")
             lines.forEach((l) => {
               invoice.addLine(
                 "Test",
                 Quantity.of(l.quantity),
                 Money.fromCents(l.unitPriceCents),
                 VatRate.fromPercentage(l.vatRate)
               )
             })

             const lineTotal = invoice
               .getLines()
               .reduce((sum, l) => sum.add(l.grossAmount), Money.zero())

             expect(invoice.totalAmount.equals(lineTotal)).toBe(true)
           }
         )
       )
     })
   })
   ```

2. **Add golden tests for regulated outputs**

   ```typescript
   describe("PDV-S XML generation", () => {
     it("matches approved output", () => {
       const input = loadFixture("pdv-s-input.json")
       const output = generatePdvSXml(input)
       const expected = loadFixture("pdv-s-expected.xml")
       expect(output).toEqual(expected)
     })
   })
   ```

3. **Enable Playwright E2E in CI**

4. **Add coverage thresholds for domain**

   ```json
   // vitest.config.ts
   {
     "coverage": {
       "thresholds": {
         "src/domain/**/*": {
           "statements": 90,
           "branches": 85,
           "functions": 90,
           "lines": 90
         }
       }
     }
   }
   ```

#### Success Criteria

- [ ] Property tests for all value objects
- [ ] Property tests for aggregate invariants
- [ ] Golden tests for fiscal and VAT outputs
- [ ] E2E tests in CI
- [ ] 90% coverage on domain layer

---

### Phase 8: Lock-Down (Week 17)

**Purpose:** Prevent regression permanently.

#### Actions

1. **Promote all warnings to errors**

   ```json
   {
     "rules": {
       "@typescript-eslint/no-floating-promises": "error",
       "@typescript-eslint/no-misused-promises": "error",
       "@typescript-eslint/no-explicit-any": "error",
       "fisk-money/no-float-money": "error"
     }
   }
   ```

2. **Add pre-commit hooks**

   ```bash
   # .husky/pre-commit
   npm run lint
   npm run typecheck
   npm run test -- --run
   ```

3. **Document architecture**

   File: `docs/ARCHITECTURE.md`
   - Layer diagram
   - Bounded context map
   - AI agent rules

4. **Remove legacy code paths**
   - Delete deprecated `src/lib/invoicing/` aliases
   - Delete manual validation patterns

#### Success Criteria

- [ ] Zero ESLint warnings
- [ ] Zero TypeScript errors
- [ ] All tests pass
- [ ] Architecture documented
- [ ] Legacy code removed

---

## 5. Final Target Architecture Definition

### Directory Structure

```
src/
├── domain/                          # PURE BUSINESS LOGIC
│   ├── shared/                      # Shared value objects
│   │   ├── Money.ts                 # Money value object (decimal.js)
│   │   ├── VatRate.ts               # VAT rate value object
│   │   ├── Quantity.ts              # Quantity value object
│   │   ├── EntityId.ts              # Type-safe entity IDs
│   │   └── index.ts
│   ├── invoicing/                   # Invoice bounded context
│   │   ├── Invoice.ts               # Aggregate root
│   │   ├── InvoiceLine.ts           # Entity
│   │   ├── InvoiceStatus.ts         # Status enum
│   │   ├── InvoiceRepository.ts     # Repository interface (port)
│   │   ├── events/
│   │   │   ├── InvoiceIssued.ts
│   │   │   ├── InvoiceFiscalized.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── fiscalization/               # Fiscalization bounded context
│   │   ├── FiscalizationRequest.ts  # Aggregate root
│   │   ├── FiscalState.ts           # State machine
│   │   ├── ZkiGenerator.ts          # Domain service
│   │   └── index.ts
│   ├── tax/                         # Tax bounded context
│   │   ├── VatCalculator.ts         # Domain service
│   │   ├── TaxRate.ts               # Entity
│   │   └── index.ts
│   ├── banking/                     # Banking bounded context
│   │   ├── BankTransaction.ts       # Aggregate root
│   │   ├── ReconciliationMatch.ts   # Value object
│   │   └── index.ts
│   ├── compliance/                  # Compliance bounded context
│   │   ├── Deadline.ts              # Aggregate root
│   │   ├── Obligation.ts            # Entity
│   │   └── index.ts
│   └── identity/                    # Identity bounded context
│       ├── Tenant.ts                # Aggregate root
│       ├── User.ts                  # Entity
│       └── index.ts
│
├── application/                     # USE CASES / ORCHESTRATION
│   ├── invoicing/
│   │   ├── CreateInvoiceUseCase.ts
│   │   ├── IssueInvoiceUseCase.ts
│   │   ├── FiscalizeInvoiceUseCase.ts
│   │   └── index.ts
│   ├── fiscalization/
│   │   └── ProcessFiscalRequestUseCase.ts
│   ├── tax/
│   │   └── CalculateVatUseCase.ts
│   └── banking/
│       └── ReconcileTransactionUseCase.ts
│
├── infrastructure/                  # DB, EXTERNAL APIs, QUEUES
│   ├── invoicing/
│   │   └── PrismaInvoiceRepository.ts
│   ├── fiscalization/
│   │   ├── PrismaFiscalRepository.ts
│   │   └── PoreznaClient.ts         # External API
│   ├── banking/
│   │   ├── PrismaBankRepository.ts
│   │   └── parsers/                 # Bank statement parsers
│   │       ├── ZabaParser.ts
│   │       ├── PbzParser.ts
│   │       └── index.ts
│   └── shared/
│       └── PrismaClient.ts          # DB singleton
│
├── interfaces/                      # API ROUTES, SERVER ACTIONS
│   ├── api/
│   │   ├── invoices/
│   │   │   └── route.ts             # Thin adapter
│   │   ├── fiscalization/
│   │   │   └── route.ts
│   │   └── banking/
│   │       └── route.ts
│   └── actions/                     # Server actions
│       ├── invoice.ts
│       └── fiscalization.ts
│
├── app/                             # NEXT.JS PAGES (UI ONLY)
│   ├── (app)/
│   ├── (staff)/
│   └── (admin)/
│
├── components/                      # UI COMPONENTS (NO DB)
│   ├── ui/
│   ├── patterns/
│   └── sections/
│
└── lib/                             # LEGACY + SHARED UTILITIES
    ├── api/
    │   └── validation.ts            # parseBody, parseQuery
    ├── utils/
    └── validations/                 # Zod schemas
```

### Dependency Rules (ABSOLUTE)

```
┌─────────────────────────────────────────────────────────────────┐
│                           INTERFACES                            │
│   (API routes, server actions, UI adapters)                     │
│   • Can import: application                                     │
│   • Cannot import: domain, infrastructure directly              │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                          APPLICATION                            │
│   (Use cases, orchestration)                                    │
│   • Can import: domain                                          │
│   • Cannot import: infrastructure, interfaces                   │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                          INFRASTRUCTURE                         │
│   (DB, external APIs, parsers)                                  │
│   • Can import: domain, application                             │
│   • Cannot import: interfaces                                   │
│   • Implements domain interfaces (ports)                        │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                            DOMAIN                               │
│   (Pure business logic)                                         │
│   • Cannot import: ANYTHING outside domain                      │
│   • No Prisma, no Next.js, no external SDKs                     │
│   • Only: domain/shared, decimal.js                             │
└─────────────────────────────────────────────────────────────────┘
```

### Money Rules (ABSOLUTE)

1. **All money is `Money` value object** in domain
2. **No `number` for money** anywhere in business logic
3. **Conversion happens ONLY in repositories/mappers**
4. **`parseFloat`, `Number()`, `.toFixed()` are BANNED** in:
   - `src/domain/**/*`
   - `src/application/**/*`
5. **Formatting happens ONLY in UI layer** via `Money.format()`

### Validation Rules (ABSOLUTE)

1. **Every POST/PUT/PATCH route uses Zod**
2. **No manual `if (!x)` validation**
3. **Use `parseBody()` helper**
4. **Validation errors are machine-readable**

### Test Requirements (ABSOLUTE)

| Layer          | Coverage | Test Types        |
| -------------- | -------- | ----------------- |
| Domain         | 90%+     | Unit, Property    |
| Application    | 80%+     | Unit, Integration |
| Infrastructure | 70%+     | Integration       |
| Interfaces     | 60%+     | Integration, E2E  |

---

## 6. AI Agent Rules (Final)

````markdown
# FiskAI AI Agent Coding Rules

## ABSOLUTE PROHIBITIONS

### 1. Layer Violations

```typescript
// FORBIDDEN: Domain importing infrastructure
// File: src/domain/**/*
import { db } from "@/lib/db" // ❌ NEVER
import { PrismaClient } from "@prisma/client" // ❌ NEVER
import { NextResponse } from "next/server" // ❌ NEVER
```
````

### 2. Float Money Operations

```typescript
// FORBIDDEN: Float operations on money
const total = parseFloat(amount) // ❌ NEVER
const vat = Number(net * rate).toFixed(2) // ❌ NEVER
const sum = items.reduce((s, i) => s + Number(i.amount), 0) // ❌ NEVER

// REQUIRED: Use Money value object
import { Money } from "@/domain/shared"
const total = Money.fromString(amount) // ✅ ALWAYS
const vat = net.multiply(rate).round(2) // ✅ ALWAYS
const sum = items.reduce((s, i) => s.add(i.amount), Money.zero()) // ✅ ALWAYS
```

### 3. Direct Aggregate Mutation

```typescript
// FORBIDDEN: Direct state mutation
invoice.status = "ISSUED" // ❌ NEVER
invoice.lines.push(newLine) // ❌ NEVER
invoice.totalAmount = calculateTotal() // ❌ NEVER

// REQUIRED: Use business methods
const event = invoice.issue() // ✅ ALWAYS
invoice.addLine(description, quantity, price, vatRate) // ✅ ALWAYS
// totalAmount is calculated from lines automatically
```

### 4. Unvalidated Input

```typescript
// FORBIDDEN: Manual validation
const { amount } = await request.json()
if (!amount) return error // ❌ NEVER

// REQUIRED: Zod validation
const schema = z.object({ amount: z.string() })
const data = await parseBody(request, schema) // ✅ ALWAYS
```

### 5. DB in Components

```typescript
// FORBIDDEN: Any file in src/components/
import { db } from "@/lib/db" // ❌ NEVER

// REQUIRED: Use server actions
import { getInvoices } from "@/interfaces/actions/invoice" // ✅ ALWAYS
```

## MANDATORY PATTERNS

### 1. New Domain Entity

```typescript
// File: src/domain/{context}/{Entity}.ts
export class Entity {
  private constructor(
    public readonly id: string,
    // ... immutable properties
  ) {}

  static create(...): Entity {
    // Factory with validation
  }

  // Business methods with guards
  doSomething(): DomainEvent {
    this.assertValidState()
    // ... mutation
    return new SomethingDone(...)
  }

  private assertValidState(): void {
    if (!this.canDoSomething) {
      throw new Error("Invalid state")
    }
  }
}
```

### 2. New Use Case

```typescript
// File: src/application/{context}/{Action}UseCase.ts
export class ActionUseCase {
  constructor(
    private readonly repository: Repository,
    // ... other ports
  ) {}

  async execute(input: Input): Promise<Output> {
    // 1. Load aggregate
    const entity = await this.repository.findById(input.id)

    // 2. Execute domain logic
    const event = entity.doSomething(input.data)

    // 3. Persist
    await this.repository.save(entity)

    // 4. Return result
    return { ... }
  }
}
```

### 3. New API Route

```typescript
// File: src/interfaces/api/{resource}/route.ts
import { z } from "zod"
import { parseBody } from "@/lib/api/validation"
import { ActionUseCase } from "@/application/{context}"
import { PrismaRepository } from "@/infrastructure/{context}"

const schema = z.object({
  // ... validation
})

export async function POST(request: Request) {
  const user = await requireAuth()
  const input = await parseBody(request, schema)

  const repository = new PrismaRepository()
  const useCase = new ActionUseCase(repository)

  const result = await useCase.execute({
    ...input,
    userId: user.id,
  })

  return NextResponse.json(result, { status: 201 })
}
```

## MANDATORY TESTS

### 1. Every Domain Entity

- Unit tests for all business methods
- Property tests for calculated values
- Tests for invalid state transitions

### 2. Every Use Case

- Integration tests with real DB
- Tests for success and failure paths

### 3. Every API Route

- Integration tests with real HTTP
- Tests for validation errors
- Tests for auth failures

### 4. Money Calculations

- Property tests proving:
  - a + b - b = a
  - sum(lines) = total
  - VAT >= 0

### 5. Regulated Outputs

- Golden tests for:
  - PDV-S XML
  - Fiscal payloads
  - KPR reports

## CHECKLIST BEFORE COMMITTING

- [ ] No `parseFloat`/`Number()`/`.toFixed()` in domain/application
- [ ] No `db` imports in domain/application/components
- [ ] All API inputs validated with Zod
- [ ] All async functions awaited (or explicitly void)
- [ ] New domain logic has unit tests
- [ ] New use cases have integration tests
- [ ] TypeScript compiles with zero errors
- [ ] ESLint passes with zero warnings

```

---

## Summary

This remediation plan transforms FiskAI from an architecturally unsound system into an enterprise-grade, audit-defensible platform through:

1. **17 weeks** of structured remediation
2. **7 bounded contexts** with clear ownership
3. **4-layer architecture** with ESLint enforcement
4. **Pure Money value object** eliminating float risk
5. **100% validation coverage** at boundaries
6. **Property + golden tests** proving correctness
7. **Strict AI agent rules** preventing regression

The plan is executable, measurable, and results in a system where correctness is enforced by tooling, not willpower.
```
