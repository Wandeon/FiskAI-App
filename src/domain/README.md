# Domain Layer

Pure business logic with no external dependencies.

## Purpose

Contains the core business rules, entities, value objects, and domain services.
This is the heart of the system - it knows nothing about databases, HTTP, or frameworks.

## Import Rules

- **CAN import:** Other domain modules, standard library, pure utility libraries (e.g., `decimal.js`)
- **CANNOT import:** `@prisma/client`, `next`, `react`, database utilities, infrastructure, application layer

## Structure

- `shared/` - Shared value objects (Money, Quantity, VatRate)
- `invoicing/` - Invoice aggregate and related entities
- `tax/` - VAT calculation domain logic
- `fiscalization/` - Fiscal request state machine
- `banking/` - Bank transaction domain
- `compliance/` - Deadline and compliance status
- `identity/` - Tenant and permission models

## Principles

1. **No Side Effects**: Domain logic should be pure - given the same inputs, always produce the same outputs
2. **Rich Domain Model**: Entities contain behavior, not just data
3. **Value Objects**: Immutable objects that represent concepts (Money, VatRate, etc.)
4. **Domain Events**: Express what happened in business terms
5. **Repository Interfaces**: Define contracts here, implement in infrastructure

## Example

```typescript
// src/domain/shared/Money.ts
import Decimal from "decimal.js"

export class Money {
  private constructor(private readonly amount: Decimal) {}

  static fromCents(cents: number): Money {
    return new Money(new Decimal(cents).dividedBy(100))
  }

  static fromDecimal(value: number | string): Money {
    return new Money(new Decimal(value))
  }

  add(other: Money): Money {
    return new Money(this.amount.plus(other.amount))
  }

  subtract(other: Money): Money {
    return new Money(this.amount.minus(other.amount))
  }

  multiply(factor: number): Money {
    return new Money(this.amount.times(factor))
  }

  toNumber(): number {
    return this.amount.toNumber()
  }

  equals(other: Money): boolean {
    return this.amount.equals(other.amount)
  }
}
```

```typescript
// src/domain/invoicing/Invoice.ts
import { Money } from "../shared/Money"
import { VatRate } from "../shared/VatRate"

export interface InvoiceItem {
  description: string
  quantity: number
  unitPrice: Money
  vatRate: VatRate
}

export class Invoice {
  private constructor(
    readonly id: string,
    readonly items: readonly InvoiceItem[],
    readonly issuedAt: Date
  ) {}

  static create(id: string, items: InvoiceItem[]): Invoice {
    if (items.length === 0) {
      throw new Error("Invoice must have at least one item")
    }
    return new Invoice(id, items, new Date())
  }

  get totalNet(): Money {
    return this.items.reduce(
      (sum, item) => sum.add(item.unitPrice.multiply(item.quantity)),
      Money.fromCents(0)
    )
  }

  get totalVat(): Money {
    return this.items.reduce(
      (sum, item) => sum.add(item.unitPrice.multiply(item.quantity).multiply(item.vatRate.rate)),
      Money.fromCents(0)
    )
  }

  get totalGross(): Money {
    return this.totalNet.add(this.totalVat)
  }
}
```

## Testing

Domain logic should be the easiest to test - no mocks needed for external services.

```typescript
describe("Money", () => {
  it("adds two money values", () => {
    const a = Money.fromCents(100)
    const b = Money.fromCents(50)
    expect(a.add(b).toNumber()).toBe(1.5)
  })
})
```
