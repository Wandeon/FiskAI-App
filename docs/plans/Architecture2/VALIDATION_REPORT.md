# Architecture2 Documents Validation Report

**Status:** VALIDATED WITH ADJUSTMENTS REQUIRED
**Date:** 2025-01-01
**Validated Against:** Actual FiskAI codebase at `/home/admin/FiskAI`

---

## Executive Summary

The Architecture2 documents define a **valid and necessary target state** for FiskAI. However, they were written without access to the actual codebase and assume a different starting point than reality. This report identifies the gaps between the documents' assumptions and the actual codebase state, then proposes specific adjustments to make the migration plan executable.

**Key Finding:** The 4-layer architecture (`src/domain/`, `src/application/`, `src/infrastructure/`, `src/interfaces/`) **does not exist**. All business logic currently lives in `src/lib/`. The migration plan must be adjusted to **create** these directories and migrate code into them.

---

## 1. Architecture Constitution Validation

### 1.1 Required Structure vs Actual Structure

**Constitution Expects:**

```
src/
├── domain/            # Pure business logic
├── application/       # Use cases / orchestration
├── infrastructure/    # DB, external systems
├── interfaces/        # API routes, server actions
```

**Actual Structure:**

```
src/
├── app/              # Next.js App Router (pages + API routes)
├── components/       # UI components (some import DB!)
├── lib/              # ALL business logic lives here
│   ├── banking/      # 11 files
│   ├── fiscal/       # 17 files
│   ├── fiscal-rules/ # 3 files
│   ├── vat/          # VAT calculations
│   ├── invoicing/    # 2 files (anemic types only!)
│   ├── compliance/   # 3 files
│   ├── reports/      # Report generators
│   └── ...81 total directories
├── config/
├── contexts/
├── hooks/
├── stores/
└── types/
```

**Gap Severity:** CRITICAL
**Impact:** Phase 0 cannot "enable strict blocking CI for domain/application" because those directories don't exist.

### 1.2 Dependency Direction Violations

| Violation Type                         | Count | Example                                       |
| -------------------------------------- | ----- | --------------------------------------------- |
| UI components importing Prisma/@lib/db | 23    | `src/components/staff/dashboard.tsx`          |
| API routes importing Prisma directly   | 50+   | `src/app/api/banking/reconciliation/route.ts` |
| Business logic mixed with DB access    | All   | `src/lib/fiscal-rules/service.ts`             |

**Evidence:**

```bash
# UI components importing DB
grep -r '@prisma/client\|from "@/lib/db"' src/components/
# Returns 23 files
```

### 1.3 Value Objects

**Constitution Requires:** Money, Quantity, VatRate value objects
**Actual State:** NONE EXIST

```bash
grep -r 'class Money\|type Money\|interface Money' src/
# Returns 0 results
```

### 1.4 Aggregate / Rich Domain Model

**Constitution Requires:** Business verbs (`invoice.issue()`, `invoice.addLine()`)
**Actual State:** Anemic type aliases only

**Example from `src/lib/invoicing/models.ts`:**

```typescript
import type { EInvoice, EInvoiceLine, InvoiceSequence } from "@prisma/client"
export type Invoice = EInvoice
export type InvoiceLine = EInvoiceLine
```

This is the opposite of a rich domain model - it's just Prisma type re-exports.

---

## 2. Correctness & Safety Standards Validation

### 2.1 Money & Numerical Correctness

**Standard Requires:** No floats, no parseFloat, no .toFixed() for money
**Actual State:** CRITICAL VIOLATION

| Pattern                          | Occurrences | Decimal.js Usage |
| -------------------------------- | ----------- | ---------------- |
| `parseFloat\|Number(\|.toFixed(` | **505**     | 18               |

**Ratio:** 28:1 dangerous float operations vs safe Decimal usage

**Critical Example from `src/lib/fiscal-rules/service.ts:121-122`:**

```typescript
const vatAmount = Number((input.netAmount * selectedRate.rate).toFixed(2))
const grossAmount = Number((input.netAmount + vatAmount).toFixed(2))
```

This is calculating VAT using the exact forbidden pattern.

### 2.2 Validation Coverage

**Standard Requires:** 100% Zod validation at all boundaries
**Actual State:** 23% coverage

| Metric                   | Value |
| ------------------------ | ----- |
| Total API routes/actions | 237   |
| Files with Zod usage     | 55    |
| Coverage                 | 23.2% |

### 2.3 State Machines

**Standard Requires:** Explicit state machines for regulated entities
**Actual State:** States exist but enforcement is implicit

```typescript
// Prisma schema has enums, but no domain enforcement
enum InvoiceStatus {
  DRAFT,
  ISSUED,
  FISCALIZED,
  PAID,
  CANCELED,
}
```

The transitions are not guarded by domain methods.

### 2.4 Async Safety

**Standard Requires:** No floating promises, all promises awaited
**Actual State:** No ESLint rules enforcing this

```bash
grep -r '@typescript-eslint/no-floating-promises' .eslintrc*
# Returns 0 results
```

---

## 3. CI & Enforcement Specification Validation

### 3.1 TypeScript Configuration

**Specification Requires:** Split tsconfig (strict + legacy)
**Actual State:** Single tsconfig.json

```json
{
  "compilerOptions": {
    "strict": true
    // ... applied to entire codebase
  }
}
```

**Gap:** No strict/legacy separation for ratchet strategy.

### 3.2 TypeScript Blocking in CI

**Specification Requires:** TypeScript errors block merges
**Actual State:** Non-blocking

```yaml
# .github/workflows/ci.yml:48
continue-on-error: true
```

**Current TypeScript Errors:** 14

### 3.3 Integration Tests

**Specification Requires:** Integration tests run in CI
**Actual State:** Disabled

```yaml
# .github/workflows/ci.yml:146
if: false # DISABLED
```

### 3.4 ESLint Architecture Firewall

**Specification Requires:**

- Domain cannot import infrastructure/frameworks
- UI cannot import DB/Prisma
- Async safety rules

**Actual State:**

- Has component layer boundaries (design system)
- NO architecture layer boundaries
- NO async safety rules
- NO money safety rules

```json
// Current .eslintrc.json has:
"import/no-restricted-paths": [
  // Only component hierarchy rules
  // NO domain/application/infrastructure rules
]
```

---

## 4. Migration Plan Validation

### 4.1 Phase 0: Containment

**Plan Assumes:** Enable strict CI for existing `src/domain/**` and `src/application/**`
**Reality:** These directories don't exist

**ADJUSTMENT REQUIRED:**
Phase 0 must:

1. Create the 4-layer directory structure
2. Add ESLint firewall rules that will apply once code is migrated
3. Fix the 14 TypeScript errors
4. Make TypeScript check blocking
5. Enable integration tests

### 4.2 Phase 1: Domain Primitives

**Plan Assumes:** Replace float usage in domain paths
**Reality:** No domain layer exists; floats are everywhere in `src/lib/`

**ADJUSTMENT REQUIRED:**
Phase 1 must:

1. Create `src/domain/shared/Money.ts` (as specified in Reference Implementation)
2. Create `src/domain/shared/Quantity.ts`
3. Create `src/domain/shared/VatRate.ts`
4. Start with `src/lib/fiscal-rules/service.ts` as first migration target
5. Create infrastructure mappers for DB ↔ domain conversion

### 4.3 Phase 2: Vertical Slice (Invoice)

**Plan Assumes:** Create invoicing bounded context
**Reality:** `src/lib/invoicing/` has only 2 files with anemic types

**ADJUSTMENT REQUIRED:**
Phase 2 must:

1. Create `src/domain/invoicing/Invoice.ts` (rich aggregate)
2. Create `src/domain/invoicing/InvoiceLine.ts` (entity)
3. Create `src/application/invoicing/CreateInvoice.ts` (use case)
4. Create `src/infrastructure/invoicing/PrismaInvoiceRepository.ts`
5. Create `src/interfaces/invoicing/` adapters
6. Migrate logic from existing scattered locations

---

## 5. Files Requiring Migration (Priority Order)

### Tier 1: Critical Money/Tax Logic (Phase 1-2)

| Current Location                      | Target Location                         | Reason                          |
| ------------------------------------- | --------------------------------------- | ------------------------------- |
| `src/lib/fiscal-rules/service.ts`     | `src/domain/tax/VatCalculator.ts`       | 10 float violations in VAT calc |
| `src/lib/vat/output-calculator.ts`    | `src/domain/tax/OutputVatCalculator.ts` | VAT calculation                 |
| `src/lib/invoicing/models.ts`         | `src/domain/invoicing/Invoice.ts`       | Anemic → Rich                   |
| `src/lib/banking/import/processor.ts` | `src/infrastructure/banking/`           | 13 float violations             |

### Tier 2: Regulated Outputs (Phase 3)

| Current Location                       | Target Location                 | Reason             |
| -------------------------------------- | ------------------------------- | ------------------ |
| `src/lib/fiscal/fiscal-pipeline.ts`    | `src/domain/fiscalization/`     | 6 float violations |
| `src/lib/reports/pdv-xml-generator.ts` | `src/infrastructure/reports/`   | 9 float violations |
| `src/lib/e-invoice/ubl-generator.ts`   | `src/infrastructure/e-invoice/` | 4 float violations |

### Tier 3: UI Components with DB Access (Phase 0)

Must remove DB imports from:

1. `src/components/staff/dashboard.tsx`
2. `src/components/admin/dashboard.tsx`
3. `src/components/documents/documents-client.tsx`
4. `src/components/settings/premises-card.tsx`
5. ... and 19 more

---

## 6. Adjusted Phase 0 Exit Criteria

Given the actual codebase state, Phase 0 exit criteria must be:

- [ ] Directory structure created: `src/domain/`, `src/application/`, `src/infrastructure/`, `src/interfaces/`
- [ ] ESLint architecture firewall rules added (will enforce as code migrates)
- [ ] ESLint async safety rules added (`no-floating-promises`, `no-misused-promises`)
- [ ] TypeScript errors reduced to 0
- [ ] TypeScript check changed to blocking in CI (`continue-on-error: false`)
- [ ] Integration tests enabled in CI
- [ ] 23 UI components no longer import DB/Prisma directly

---

## 7. Conclusion

The Architecture2 documents are **architecturally sound** and define the correct target state for a regulated financial system. However, they must be adapted for the actual FiskAI codebase which:

1. Has no 4-layer architecture structure
2. Has all business logic in `src/lib/` with DB access mixed in
3. Has 505 dangerous float money operations
4. Has only 23% Zod validation coverage
5. Has non-blocking TypeScript and disabled integration tests

The attached Phase 0 Implementation Plan provides the specific, file-level actions needed to begin this migration.

---

**Next Document:** Phase 0 Implementation Plan
