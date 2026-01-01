# Phase 7: Testing Expansion - Implementation Plan

**Status:** READY FOR EXECUTION (after Phase 6)
**Depends On:** Phase 6 Completion (100% validation coverage)
**Duration Estimate:** 3-4 focused sessions
**Goal:** Prove correctness, not assume it

---

## 0. Phase 7 Objectives

1. Add property-based tests for all money operations
2. Add property-based tests for all VAT calculations
3. Add property-based tests for all state machines
4. Add E2E tests for critical user flows
5. Enforce golden tests for all regulated outputs
6. Create CI gates that block missing tests

---

## 1. Current Testing State

| Test Type                   | Current  | Target  |
| --------------------------- | -------- | ------- |
| Unit tests (Vitest)         | ~50      | 200+    |
| Property tests (fast-check) | 0        | 30+     |
| Integration tests           | Disabled | Enabled |
| Golden tests                | 0        | 10+     |
| E2E tests                   | 0        | 5+      |

---

## 2. Property-Based Testing Setup

### 2.1 Install fast-check

```bash
npm install --save-dev fast-check
```

### 2.2 Required Property Tests

#### Money Invariants

**`src/domain/shared/__tests__/Money.property.test.ts`:**

```typescript
import fc from "fast-check"
import { Money } from "../Money"

describe("Money property tests", () => {
  // Commutativity: a + b = b + a
  it("addition is commutative", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        const m1 = Money.fromCents(a)
        const m2 = Money.fromCents(b)
        expect(m1.add(m2).equals(m2.add(m1))).toBe(true)
      })
    )
  })

  // Associativity: (a + b) + c = a + (b + c)
  it("addition is associative", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), fc.integer(), (a, b, c) => {
        const m1 = Money.fromCents(a)
        const m2 = Money.fromCents(b)
        const m3 = Money.fromCents(c)
        expect(
          m1
            .add(m2)
            .add(m3)
            .equals(m1.add(m2.add(m3)))
        ).toBe(true)
      })
    )
  })

  // Identity: a + 0 = a
  it("zero is identity for addition", () => {
    fc.assert(
      fc.property(fc.integer(), (a) => {
        const money = Money.fromCents(a)
        expect(money.add(Money.zero()).equals(money)).toBe(true)
      })
    )
  })

  // Inverse: a - a = 0
  it("subtraction inverse", () => {
    fc.assert(
      fc.property(fc.integer(), (a) => {
        const money = Money.fromCents(a)
        expect(money.subtract(money).isZero()).toBe(true)
      })
    )
  })

  // Roundtrip: fromCents(toCents(m)) = m
  it("cents roundtrip", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1_000_000_00, max: 1_000_000_00 }), (cents) => {
        const money = Money.fromCents(cents)
        expect(Money.fromCents(money.toCents()).equals(money)).toBe(true)
      })
    )
  })

  // No precision loss in multiplication
  it("multiplication preserves precision", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        fc.integer({ min: 1, max: 100 }),
        (cents, factor) => {
          const money = Money.fromCents(cents)
          const result = money.multiply(factor)
          // Should be representable in cents
          expect(() => result.toCents()).not.toThrow()
        }
      )
    )
  })
})
```

#### VAT Invariants

**`src/domain/tax/__tests__/VatCalculator.property.test.ts`:**

```typescript
import fc from "fast-check"
import { VatCalculator } from "../VatCalculator"
import { Money, VatRate } from "@/domain/shared"

describe("VatCalculator property tests", () => {
  // VAT is always non-negative
  it("VAT is never negative", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.constantFrom(0.25, 0.13, 0.05, 0),
        (cents, rate) => {
          const net = Money.fromCents(cents)
          const vatRate = VatRate.standard(rate)
          const result = VatCalculator.calculate(net, vatRate)
          expect(result.vatAmount.isNegative()).toBe(false)
        }
      )
    )
  })

  // Gross = Net + VAT
  it("gross equals net plus VAT", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.constantFrom(0.25, 0.13, 0.05),
        (cents, rate) => {
          const net = Money.fromCents(cents)
          const vatRate = VatRate.standard(rate)
          const result = VatCalculator.calculate(net, vatRate)

          const expectedGross = result.netAmount.add(result.vatAmount)
          expect(result.grossAmount.equals(expectedGross)).toBe(true)
        }
      )
    )
  })

  // Extracting from gross reverses calculation (within rounding)
  it("extract reverses calculate", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 1_000_000 }), // Min 1.00 to avoid rounding issues
        fc.constantFrom(0.25, 0.13, 0.05),
        (cents, rate) => {
          const net = Money.fromCents(cents)
          const vatRate = VatRate.standard(rate)

          const calculated = VatCalculator.calculate(net, vatRate)
          const extracted = VatCalculator.calculateFromGross(calculated.grossAmount, vatRate)

          // Allow 1 cent tolerance for rounding
          const diff = calculated.netAmount.subtract(extracted.netAmount).toDecimal().abs()
          expect(diff.lessThanOrEqualTo(0.01)).toBe(true)
        }
      )
    )
  })

  // Zero rate means zero VAT
  it("zero rate produces zero VAT", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000_000 }), (cents) => {
        const net = Money.fromCents(cents)
        const result = VatCalculator.calculate(net, VatRate.zero())
        expect(result.vatAmount.isZero()).toBe(true)
        expect(result.grossAmount.equals(result.netAmount)).toBe(true)
      })
    )
  })
})
```

#### State Machine Invariants

**`src/domain/invoicing/__tests__/InvoiceStatus.property.test.ts`:**

```typescript
import fc from "fast-check"
import { Invoice, InvoiceStatus } from "../"
import { Money, Quantity, VatRate, InvoiceLine } from "@/domain/shared"

describe("Invoice state machine properties", () => {
  const createValidInvoice = () => {
    const invoice = Invoice.create("buyer", "seller")
    invoice.addLine(
      InvoiceLine.create({
        description: "Test",
        quantity: Quantity.of(1),
        unitPrice: Money.fromCents(10000),
        vatRate: VatRate.HR_STANDARD,
      })
    )
    return invoice
  }

  // Once fiscalized, cannot go back to draft
  it("fiscalized is irreversible", () => {
    const invoice = createValidInvoice()
    invoice.issue(InvoiceNumber.create(1, 1, 1, 2025), new Date(), futureDate())
    invoice.fiscalize("JIR-123", "ZKI-456")

    expect(invoice.status).toBe(InvoiceStatus.FISCALIZED)
    // Cannot modify
    expect(() => invoice.addLine(createLine())).toThrow()
  })

  // Terminal states have no outgoing transitions
  it("terminal states are final", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(InvoiceStatus.CANCELED, InvoiceStatus.ARCHIVED),
        (terminalStatus) => {
          // These statuses should have no valid transitions
          const allStatuses = Object.values(InvoiceStatus)
          for (const target of allStatuses) {
            if (target !== terminalStatus) {
              expect(canTransition(terminalStatus, target)).toBe(false)
            }
          }
        }
      )
    )
  })

  // All paths eventually reach terminal
  it("all valid paths reach terminal state", () => {
    // DRAFT → PENDING → FISCALIZED → SENT → ACCEPTED → ARCHIVED
    const invoice = createValidInvoice()
    expect(isTerminal(invoice.status)).toBe(false)

    invoice.issue(InvoiceNumber.create(1, 1, 1, 2025), new Date(), futureDate())
    invoice.fiscalize("JIR", "ZKI")
    invoice.markSent()
    invoice.accept()
    invoice.archive()

    expect(isTerminal(invoice.status)).toBe(true)
  })
})
```

---

## 3. Golden Tests for Regulated Outputs

### 3.1 Create Fixture Directory

```bash
mkdir -p src/infrastructure/fiscal/__tests__/fixtures
mkdir -p src/infrastructure/reports/__tests__/fixtures
```

### 3.2 Fiscal XML Golden Test

**`src/infrastructure/fiscal/__tests__/XmlBuilder.golden.test.ts`:**

```typescript
import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"
import { buildFiscalXml } from "../XmlBuilder"
import { createTestInput } from "./helpers"

describe("Fiscal XML Golden Tests", () => {
  it("standard invoice XML matches fixture", () => {
    const input = createTestInput("standard")
    const xml = buildFiscalXml(input)

    const fixturePath = path.join(__dirname, "fixtures/fiscal-standard.xml")
    assertMatchesGolden(xml, fixturePath)
  })

  it("storno invoice XML matches fixture", () => {
    const input = createTestInput("storno")
    const xml = buildFiscalXml(input)

    const fixturePath = path.join(__dirname, "fixtures/fiscal-storno.xml")
    assertMatchesGolden(xml, fixturePath)
  })
})

function assertMatchesGolden(actual: string, fixturePath: string) {
  const normalized = normalizeXml(actual)

  if (!fs.existsSync(fixturePath)) {
    fs.mkdirSync(path.dirname(fixturePath), { recursive: true })
    fs.writeFileSync(fixturePath, normalized)
    console.log(`Created new golden fixture: ${fixturePath}`)
    return
  }

  const expected = fs.readFileSync(fixturePath, "utf8")
  expect(normalized).toBe(expected)
}

function normalizeXml(xml: string): string {
  return xml
    .replace(/<tns:IdPoruke>.*?<\/tns:IdPoruke>/g, "<tns:IdPoruke>STABLE</tns:IdPoruke>")
    .replace(
      /<tns:DatumVrijeme>.*?<\/tns:DatumVrijeme>/g,
      "<tns:DatumVrijeme>STABLE</tns:DatumVrijeme>"
    )
    .trim()
}
```

### 3.3 VAT Report Golden Test

**`src/infrastructure/reports/__tests__/PdvXml.golden.test.ts`:**

```typescript
import { describe, it, expect } from "vitest"
import { generatePdvXml } from "../pdv-xml-generator"
import { createTestVatData } from "./helpers"

describe("PDV XML Golden Tests", () => {
  it("monthly VAT return matches fixture", () => {
    const data = createTestVatData("2025-01")
    const xml = generatePdvXml(data)

    assertMatchesGolden(xml, "fixtures/pdv-2025-01.xml")
  })

  it("quarterly VAT return matches fixture", () => {
    const data = createTestVatData("2025-Q1")
    const xml = generatePdvXml(data)

    assertMatchesGolden(xml, "fixtures/pdv-2025-Q1.xml")
  })
})
```

---

## 4. E2E Tests for Critical Flows

### 4.1 Install Playwright

```bash
npm install --save-dev @playwright/test
npx playwright install
```

### 4.2 Create E2E Test

**`e2e/invoice-flow.spec.ts`:**

```typescript
import { test, expect } from "@playwright/test"

test.describe("Invoice Creation Flow", () => {
  test("create and fiscalize invoice", async ({ page }) => {
    // Login
    await page.goto("/login")
    await page.fill('[name="email"]', "test@example.com")
    await page.fill('[name="password"]', "password")
    await page.click('button[type="submit"]')

    // Navigate to invoices
    await page.goto("/invoices/new")

    // Fill invoice form
    await page.selectOption('[name="buyerId"]', "buyer-123")
    await page.click('button:has-text("Add Line")')
    await page.fill('[name="lines.0.description"]', "Test Product")
    await page.fill('[name="lines.0.quantity"]', "2")
    await page.fill('[name="lines.0.unitPrice"]', "100.00")

    // Submit
    await page.click('button:has-text("Create Invoice")')

    // Verify success
    await expect(page.locator(".invoice-number")).toBeVisible()
    await expect(page.locator(".status-badge")).toHaveText("PENDING_FISCALIZATION")
  })
})
```

---

## 5. CI Test Gates

### 5.1 Update CI to Require Tests

**`.github/workflows/ci.yml` additions:**

```yaml
test-property:
  name: Property-Based Tests
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
    - run: npm ci --legacy-peer-deps
    - run: npx prisma generate
    - run: npm run test:property

test-golden:
  name: Golden Tests
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
    - run: npm ci --legacy-peer-deps
    - run: npx prisma generate
    - run: npm run test:golden
    - name: Check for uncommitted fixture changes
      run: |
        if [[ -n $(git status --porcelain) ]]; then
          echo "Golden fixtures were updated. Please commit them."
          git diff
          exit 1
        fi
```

### 5.2 Add Test Scripts to package.json

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:property": "vitest run --grep 'property'",
    "test:golden": "vitest run --grep 'golden'",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:e2e": "playwright test"
  }
}
```

---

## 6. Exit Criteria

Phase 7 is complete when:

- [ ] Property tests for Money (5+ invariants)
- [ ] Property tests for VAT (4+ invariants)
- [ ] Property tests for Invoice state machine (3+ invariants)
- [ ] Golden tests for fiscal XML (2+ fixtures)
- [ ] Golden tests for VAT XML (2+ fixtures)
- [ ] E2E tests for invoice flow
- [ ] CI blocks on missing property tests for domain changes
- [ ] CI blocks on uncommitted golden fixture changes

---

**Next Document:** Phase 8 Implementation Plan (Lock-Down)
