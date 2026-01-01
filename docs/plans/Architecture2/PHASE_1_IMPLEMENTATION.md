# Phase 1: Domain Primitives - Implementation Plan

**Status:** READY FOR EXECUTION (after Phase 0)
**Depends On:** Phase 0 Completion
**Duration Estimate:** 3-4 focused sessions
**Goal:** Eliminate the single highest financial risk: float-based money logic

---

## 0. Phase 1 Objectives

1. Create `Money` value object in `src/domain/shared/`
2. Create `Quantity` value object in `src/domain/shared/`
3. Create `VatRate` value object in `src/domain/shared/`
4. Create repository mappers for DB ↔ domain conversion
5. Replace float usage in critical paths (starting with VAT calculation)
6. Add property-based tests for Money invariants
7. Add ESLint rule to ban float money patterns in new code

---

## 1. Create Money Value Object

### 1.1 Install Decimal.js

```bash
npm install decimal.js
npm install --save-dev @types/decimal.js
```

### 1.2 Create `src/domain/shared/Money.ts`

This follows the Reference Implementation Pack exactly:

```typescript
// src/domain/shared/Money.ts
import Decimal from "decimal.js"

export class Money {
  private constructor(
    private readonly amount: Decimal,
    public readonly currency: string = "EUR"
  ) {}

  static fromDecimal(value: Decimal, currency = "EUR"): Money {
    return new Money(value, currency)
  }

  static fromString(value: string, currency = "EUR"): Money {
    return new Money(new Decimal(value), currency)
  }

  static fromCents(cents: number, currency = "EUR"): Money {
    if (!Number.isInteger(cents)) {
      throw new MoneyError("Money.fromCents requires integer cents")
    }
    return new Money(new Decimal(cents).dividedBy(100), currency)
  }

  static zero(currency = "EUR"): Money {
    return new Money(new Decimal(0), currency)
  }

  add(other: Money): Money {
    this.assertSameCurrency(other)
    return new Money(this.amount.plus(other.amount), this.currency)
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other)
    return new Money(this.amount.minus(other.amount), this.currency)
  }

  multiply(factor: Decimal | number | string): Money {
    const factorDecimal = factor instanceof Decimal ? factor : new Decimal(factor)
    return new Money(this.amount.mul(factorDecimal), this.currency)
  }

  divide(divisor: Decimal | number | string): Money {
    const divisorDecimal = divisor instanceof Decimal ? divisor : new Decimal(divisor)
    if (divisorDecimal.isZero()) {
      throw new MoneyError("Cannot divide by zero")
    }
    return new Money(this.amount.div(divisorDecimal), this.currency)
  }

  /**
   * Round to 2 decimal places using banker's rounding (round half to even).
   * Use this for final display/storage, not intermediate calculations.
   */
  round(): Money {
    return new Money(this.amount.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN), this.currency)
  }

  isNegative(): boolean {
    return this.amount.isNegative()
  }

  isZero(): boolean {
    return this.amount.isZero()
  }

  isPositive(): boolean {
    return this.amount.isPositive() && !this.amount.isZero()
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amount.equals(other.amount)
  }

  lessThan(other: Money): boolean {
    this.assertSameCurrency(other)
    return this.amount.lessThan(other.amount)
  }

  greaterThan(other: Money): boolean {
    this.assertSameCurrency(other)
    return this.amount.greaterThan(other.amount)
  }

  toDecimal(): Decimal {
    return this.amount
  }

  /**
   * Convert to cents for database storage.
   * Throws if the amount cannot be represented exactly in cents.
   */
  toCents(): number {
    const cents = this.amount.mul(100)
    if (!cents.isInteger()) {
      throw new MoneyError("Amount cannot be represented exactly in cents")
    }
    return cents.toNumber()
  }

  /**
   * Format for display. Use only in UI layer.
   */
  format(locale = "hr-HR"): string {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: this.currency,
    }).format(this.amount.toNumber())
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new MoneyError(`Currency mismatch: ${this.currency} vs ${other.currency}`)
    }
  }
}

export class MoneyError extends Error {
  readonly code = "MONEY_ERROR"

  constructor(message: string) {
    super(message)
    this.name = "MoneyError"
  }
}
```

### 1.3 Create Unit Tests

**`src/domain/shared/__tests__/Money.test.ts`:**

```typescript
import { describe, it, expect } from "vitest"
import { Money, MoneyError } from "../Money"

describe("Money", () => {
  describe("creation", () => {
    it("creates from string", () => {
      const money = Money.fromString("100.50")
      expect(money.toDecimal().toString()).toBe("100.5")
    })

    it("creates from cents", () => {
      const money = Money.fromCents(10050)
      expect(money.toDecimal().toString()).toBe("100.5")
    })

    it("rejects non-integer cents", () => {
      expect(() => Money.fromCents(100.5)).toThrow(MoneyError)
    })

    it("creates zero", () => {
      expect(Money.zero().isZero()).toBe(true)
    })
  })

  describe("arithmetic", () => {
    it("adds correctly", () => {
      const a = Money.fromString("100.00")
      const b = Money.fromString("50.25")
      expect(a.add(b).toDecimal().toString()).toBe("150.25")
    })

    it("subtracts correctly", () => {
      const a = Money.fromString("100.00")
      const b = Money.fromString("50.25")
      expect(a.subtract(b).toDecimal().toString()).toBe("49.75")
    })

    it("multiplies correctly", () => {
      const money = Money.fromString("100.00")
      expect(money.multiply(0.25).toDecimal().toString()).toBe("25")
    })

    it("prevents currency mixing", () => {
      const eur = Money.fromString("100", "EUR")
      const usd = Money.fromString("100", "USD")
      expect(() => eur.add(usd)).toThrow(MoneyError)
    })
  })

  describe("rounding", () => {
    it("rounds using banker's rounding", () => {
      // 0.5 rounds to even
      expect(Money.fromString("100.125").round().toDecimal().toString()).toBe("100.12")
      expect(Money.fromString("100.135").round().toDecimal().toString()).toBe("100.14")
    })
  })

  describe("toCents", () => {
    it("converts to cents", () => {
      expect(Money.fromString("100.50").toCents()).toBe(10050)
    })

    it("rejects non-representable amounts", () => {
      expect(() => Money.fromString("100.123").toCents()).toThrow(MoneyError)
    })
  })
})
```

### 1.4 Create Property-Based Tests

**`src/domain/shared/__tests__/Money.property.test.ts`:**

```typescript
import { describe, it, expect } from "vitest"
import fc from "fast-check"
import { Money } from "../Money"

describe("Money property tests", () => {
  it("addition is commutative", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        const m1 = Money.fromCents(a)
        const m2 = Money.fromCents(b)
        expect(m1.add(m2).equals(m2.add(m1))).toBe(true)
      })
    )
  })

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

  it("zero is identity for addition", () => {
    fc.assert(
      fc.property(fc.integer(), (a) => {
        const money = Money.fromCents(a)
        expect(money.add(Money.zero()).equals(money)).toBe(true)
      })
    )
  })

  it("subtract then add returns original", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        const m1 = Money.fromCents(a)
        const m2 = Money.fromCents(b)
        expect(m1.subtract(m2).add(m2).equals(m1)).toBe(true)
      })
    )
  })

  it("multiply by 1 is identity", () => {
    fc.assert(
      fc.property(fc.integer(), (a) => {
        const money = Money.fromCents(a)
        expect(money.multiply(1).equals(money)).toBe(true)
      })
    )
  })

  it("toCents then fromCents roundtrips", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000000000, max: 1000000000 }), (cents) => {
        const money = Money.fromCents(cents)
        expect(Money.fromCents(money.toCents()).equals(money)).toBe(true)
      })
    )
  })
})
```

---

## 2. Create Quantity Value Object

### 2.1 Create `src/domain/shared/Quantity.ts`

```typescript
// src/domain/shared/Quantity.ts
import Decimal from "decimal.js"

export class Quantity {
  private constructor(private readonly value: Decimal) {}

  static of(value: number | string | Decimal): Quantity {
    const decimal = value instanceof Decimal ? value : new Decimal(value)

    if (!decimal.isFinite()) {
      throw new QuantityError("Quantity must be finite")
    }

    if (decimal.isNegative()) {
      throw new QuantityError("Quantity cannot be negative")
    }

    return new Quantity(decimal)
  }

  static one(): Quantity {
    return new Quantity(new Decimal(1))
  }

  static zero(): Quantity {
    return new Quantity(new Decimal(0))
  }

  add(other: Quantity): Quantity {
    return new Quantity(this.value.plus(other.value))
  }

  subtract(other: Quantity): Quantity {
    const result = this.value.minus(other.value)
    if (result.isNegative()) {
      throw new QuantityError("Quantity cannot become negative")
    }
    return new Quantity(result)
  }

  multiply(factor: number | Decimal): Quantity {
    const factorDecimal = factor instanceof Decimal ? factor : new Decimal(factor)
    return new Quantity(this.value.mul(factorDecimal))
  }

  isZero(): boolean {
    return this.value.isZero()
  }

  equals(other: Quantity): boolean {
    return this.value.equals(other.value)
  }

  toNumber(): number {
    return this.value.toNumber()
  }

  toDecimal(): Decimal {
    return this.value
  }
}

export class QuantityError extends Error {
  readonly code = "QUANTITY_ERROR"

  constructor(message: string) {
    super(message)
    this.name = "QuantityError"
  }
}
```

---

## 3. Create VatRate Value Object

### 3.1 Create `src/domain/shared/VatRate.ts`

```typescript
// src/domain/shared/VatRate.ts
import Decimal from "decimal.js"
import { Money } from "./Money"

export class VatRate {
  private constructor(
    private readonly rate: Decimal,
    public readonly label: string,
    public readonly type: "standard" | "reduced" | "zero" | "exempt"
  ) {}

  static standard(rate: number | string, label = "Standard"): VatRate {
    return new VatRate(new Decimal(rate), label, "standard")
  }

  static reduced(rate: number | string, label: string): VatRate {
    return new VatRate(new Decimal(rate), label, "reduced")
  }

  static zero(): VatRate {
    return new VatRate(new Decimal(0), "Zero Rate", "zero")
  }

  static exempt(): VatRate {
    return new VatRate(new Decimal(0), "Exempt", "exempt")
  }

  /**
   * Croatian standard rates
   */
  static HR_STANDARD = VatRate.standard("0.25", "PDV 25%")
  static HR_REDUCED_13 = VatRate.reduced("0.13", "PDV 13%")
  static HR_REDUCED_5 = VatRate.reduced("0.05", "PDV 5%")

  /**
   * Calculate VAT amount from net amount.
   */
  calculateVat(netAmount: Money): Money {
    if (this.rate.isZero()) {
      return Money.zero(netAmount.currency)
    }
    return netAmount.multiply(this.rate).round()
  }

  /**
   * Calculate gross amount from net amount.
   */
  calculateGross(netAmount: Money): Money {
    return netAmount.add(this.calculateVat(netAmount))
  }

  /**
   * Extract net amount from gross amount.
   */
  extractNet(grossAmount: Money): Money {
    const divisor = this.rate.plus(1)
    return grossAmount.divide(divisor).round()
  }

  /**
   * Extract VAT amount from gross amount.
   */
  extractVat(grossAmount: Money): Money {
    const net = this.extractNet(grossAmount)
    return grossAmount.subtract(net)
  }

  rateAsDecimal(): Decimal {
    return this.rate
  }

  rateAsPercentage(): number {
    return this.rate.mul(100).toNumber()
  }

  equals(other: VatRate): boolean {
    return this.rate.equals(other.rate)
  }
}
```

---

## 4. Create Index Export

### 4.1 Create `src/domain/shared/index.ts`

```typescript
// src/domain/shared/index.ts
export { Money, MoneyError } from "./Money"
export { Quantity, QuantityError } from "./Quantity"
export { VatRate } from "./VatRate"
```

---

## 5. Create Infrastructure Mappers

### 5.1 Create `src/infrastructure/mappers/MoneyMapper.ts`

```typescript
// src/infrastructure/mappers/MoneyMapper.ts
import { Money } from "@/domain/shared"
import type { Prisma } from "@prisma/client"

/**
 * Maps between database representation (cents as integer) and domain Money.
 */
export class MoneyMapper {
  /**
   * Convert database cents to domain Money.
   */
  static toDomain(cents: number | bigint, currency = "EUR"): Money {
    return Money.fromCents(Number(cents), currency)
  }

  /**
   * Convert Prisma Decimal to domain Money.
   */
  static fromPrismaDecimal(value: Prisma.Decimal | null, currency = "EUR"): Money {
    if (value === null) {
      return Money.zero(currency)
    }
    return Money.fromString(value.toString(), currency)
  }

  /**
   * Convert domain Money to database cents.
   */
  static toPersistence(money: Money): number {
    return money.toCents()
  }

  /**
   * Convert domain Money to Prisma Decimal for storage.
   */
  static toPrismaDecimal(money: Money): Prisma.Decimal {
    return new Prisma.Decimal(money.toDecimal().toString())
  }
}
```

---

## 6. Migrate First Critical Path: VAT Calculation

### 6.1 Current Code (VIOLATING)

**`src/lib/fiscal-rules/service.ts:121-122`:**

```typescript
const vatAmount = Number((input.netAmount * selectedRate.rate).toFixed(2))
const grossAmount = Number((input.netAmount + vatAmount).toFixed(2))
```

### 6.2 Create Domain VAT Calculator

**`src/domain/tax/VatCalculator.ts`:**

```typescript
// src/domain/tax/VatCalculator.ts
import { Money } from "@/domain/shared"
import { VatRate } from "@/domain/shared"

export interface VatCalculationResult {
  netAmount: Money
  vatRate: VatRate
  vatAmount: Money
  grossAmount: Money
}

export class VatCalculator {
  static calculate(netAmount: Money, rate: VatRate): VatCalculationResult {
    const vatAmount = rate.calculateVat(netAmount)
    const grossAmount = netAmount.add(vatAmount)

    return {
      netAmount,
      vatRate: rate,
      vatAmount,
      grossAmount,
    }
  }

  static calculateFromGross(grossAmount: Money, rate: VatRate): VatCalculationResult {
    const netAmount = rate.extractNet(grossAmount)
    const vatAmount = rate.extractVat(grossAmount)

    return {
      netAmount,
      vatRate: rate,
      vatAmount,
      grossAmount,
    }
  }
}
```

### 6.3 Update Fiscal Rules Service

The existing service should call the domain calculator:

```typescript
// Updated src/lib/fiscal-rules/service.ts (Application layer adapter)
import { VatCalculator } from "@/domain/tax/VatCalculator"
import { Money, VatRate } from "@/domain/shared"

function calculateVat(data: VatRuleData, input: { netAmount?: number; rate?: number }) {
  // ...existing rate selection logic...

  if (input.netAmount === undefined) {
    return { rate: selectedRate.rate, label: selectedRate.label }
  }

  // NEW: Use domain calculator
  const netMoney = Money.fromString(input.netAmount.toString())
  const vatRate = VatRate.standard(selectedRate.rate.toString(), selectedRate.label)
  const result = VatCalculator.calculate(netMoney, vatRate)

  return {
    rate: selectedRate.rate,
    label: selectedRate.label,
    netAmount: result.netAmount.toDecimal().toNumber(),
    vatAmount: result.vatAmount.toDecimal().toNumber(),
    grossAmount: result.grossAmount.toDecimal().toNumber(),
  }
}
```

---

## 7. Add ESLint Rule to Ban Float Money Patterns

### 7.1 Update `.eslintrc.json`

Add to the domain/application overrides:

```json
{
  "overrides": [
    {
      "files": ["src/domain/**/*", "src/application/**/*"],
      "rules": {
        "no-restricted-syntax": [
          "error",
          {
            "selector": "CallExpression[callee.name='parseFloat']",
            "message": "parseFloat is forbidden in domain/application. Use Money.fromString()."
          },
          {
            "selector": "CallExpression[callee.name='Number'][arguments.length=1]",
            "message": "Number() is forbidden for money. Use Money value object."
          },
          {
            "selector": "CallExpression[callee.property.name='toFixed']",
            "message": ".toFixed() is forbidden for money. Use Money.round()."
          }
        ]
      }
    }
  ]
}
```

---

## 8. Migration Sequence for Remaining Float Violations

### Priority Files (505 total violations)

| Priority | File                                   | Violations | Action                            |
| -------- | -------------------------------------- | ---------- | --------------------------------- |
| 1        | `src/lib/fiscal-rules/service.ts`      | 10         | Migrate to domain calculator      |
| 2        | `src/lib/reports/kpr-generator.ts`     | 30         | Use Money for report calculations |
| 3        | `src/lib/reports/posd-generator.ts`    | 47         | Use Money for report calculations |
| 4        | `src/lib/reports/ura-ira.ts`           | 32         | Use Money for VAT register        |
| 5        | `src/lib/reports/accountant-export.ts` | 20         | Use Money for exports             |
| 6        | `src/lib/banking/import/processor.ts`  | 13         | Use Money for bank imports        |
| 7        | `src/lib/reports/kpr.ts`               | 16         | Use Money                         |
| 8        | `src/lib/reports/kpr-excel.ts`         | 15         | Use Money                         |

**Strategy:** Start with the domain calculator, then progressively migrate each file. Each migration should:

1. Create a domain equivalent if business logic
2. Or use Money at the edges if it's infrastructure

---

## 9. Verification Checklist

```bash
# 1. Domain layer has no forbidden imports
npm run lint -- --ext .ts src/domain/
# Expected: No errors

# 2. Property tests pass
npm test -- src/domain/shared/__tests__/Money.property.test.ts
# Expected: All pass

# 3. Unit tests pass
npm test -- src/domain/shared/__tests__/
# Expected: All pass

# 4. No new float violations in domain
grep -r 'parseFloat\|Number(\|\.toFixed(' src/domain/
# Expected: No matches
```

---

## 10. Exit Criteria

Phase 1 is complete when:

- [ ] `src/domain/shared/Money.ts` created and tested
- [ ] `src/domain/shared/Quantity.ts` created and tested
- [ ] `src/domain/shared/VatRate.ts` created and tested
- [ ] `src/infrastructure/mappers/MoneyMapper.ts` created
- [ ] `src/domain/tax/VatCalculator.ts` created (first vertical slice of domain logic)
- [ ] ESLint rule banning float patterns in domain/application added
- [ ] Property-based tests for Money pass
- [ ] At least one existing float-heavy file migrated (`fiscal-rules/service.ts`)

---

## 11. What Phase 1 Does NOT Include

- Full migration of all 505 float violations (that continues in Phase 2-3)
- Invoice aggregate (that's Phase 2)
- Repository implementations (that's Phase 2)
- Schema migrations (not needed for this phase)
- UI changes

---

**Next Document:** Phase 2 Implementation Plan (Vertical Slice: Invoice)
