# Domain Layer

Pure business logic with no external dependencies.

## Purpose

Contains the core business rules, entities, value objects, and domain services.
This is the heart of the system - it knows nothing about databases, HTTP, or frameworks.

## Import Rules

- **CAN import:** Other domain modules, standard library, pure utility libraries (e.g., `decimal.js`)
- **CANNOT import:** `@prisma/client`, `next`, `react`, database utilities, infrastructure, application layer

## Bounded Contexts

FiskAI is organized into 7 bounded contexts with clear ownership boundaries:

### 1. shared/ - Core Value Objects

**Owner:** Platform Team
**Purpose:** Foundational value objects used across all contexts

| Type       | Description                                  |
| ---------- | -------------------------------------------- |
| `Money`    | Arbitrary precision currency with Decimal.js |
| `VatRate`  | VAT rate with calculation methods            |
| `Quantity` | Non-negative quantities with units           |

### 2. invoicing/ - Invoice Context

**Owner:** Invoicing Team
**Purpose:** Invoice lifecycle management

| Type            | Description                                    |
| --------------- | ---------------------------------------------- |
| `Invoice`       | Aggregate root - line management, calculations |
| `InvoiceLine`   | Entity - quantity × price calculations         |
| `InvoiceId`     | Value object - formatted invoice identifiers   |
| `InvoiceStatus` | State machine - DRAFT→ISSUED→FISCALIZED        |

### 3. fiscalization/ - Fiscal Context

**Owner:** Compliance Team
**Purpose:** Croatian tax authority integration

| Type            | Description                                       |
| --------------- | ------------------------------------------------- |
| `FiscalRequest` | Aggregate root - submission state machine         |
| `FiscalStatus`  | State machine - QUEUED→SUBMITTED→COMPLETED/FAILED |
| `ZkiCalculator` | Domain service - ZKI hash generation              |

### 4. tax/ - Tax Calculation Context

**Owner:** Compliance Team
**Purpose:** VAT and tax calculation logic

| Type            | Description                         |
| --------------- | ----------------------------------- |
| `VatCalculator` | Domain service - VAT calculations   |
| `VatBreakdown`  | Value object - itemized VAT by rate |

### 5. banking/ - Banking Context

**Owner:** Banking Team
**Purpose:** Bank transactions and reconciliation

| Type                    | Description                              |
| ----------------------- | ---------------------------------------- |
| `BankTransaction`       | Aggregate root - transaction with status |
| `ReconciliationMatcher` | Domain service - matching algorithm      |
| `ImportDeduplicator`    | Domain service - idempotent imports      |

### 6. compliance/ - Compliance Context

**Owner:** Compliance Team
**Purpose:** Regulatory deadlines and obligations

| Type                 | Description                            |
| -------------------- | -------------------------------------- |
| `ComplianceDeadline` | Aggregate root - deadline scheduling   |
| `Recurrence`         | Value object - recurrence patterns     |
| `ApplicabilityRule`  | Value object - business type targeting |

### 7. identity/ - Identity Context

**Owner:** Platform Team
**Purpose:** Multi-tenancy and access control

| Type              | Description                                         |
| ----------------- | --------------------------------------------------- |
| `Tenant`          | Aggregate root - company with members               |
| `StaffAssignment` | Entity - staff-to-tenant assignments                |
| `OIB`             | Value object - Croatian tax ID with checksum        |
| `TenantRole`      | Value object - OWNER/ADMIN/MEMBER/ACCOUNTANT/VIEWER |

## Context Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                           IDENTITY                                   │
│                    (Tenant, StaffAssignment)                        │
│                         [Platform Team]                              │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  │ Company ID flows to all contexts
                                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  INVOICING  │───▶│FISCALIZATION│───▶│COMPLIANCE   │◀───│   BANKING   │
│  (Invoice)  │    │(FiscalReq)  │    │(Deadline)   │    │(BankTxn)    │
│[Invoicing]  │    │[Compliance] │    │[Compliance] │    │[Banking]    │
└──────┬──────┘    └─────────────┘    └─────────────┘    └──────┬──────┘
       │                                                        │
       │                                                        │
       └────────────────────┬───────────────────────────────────┘
                            │
                            ▼
                    ┌─────────────┐
                    │     TAX     │
                    │(VatCalc)    │
                    │[Compliance] │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   SHARED    │
                    │(Money,Qty)  │
                    │[Platform]   │
                    └─────────────┘
```

## Cross-Context Rules

1. **Upstream/Downstream**: Identity is upstream (provides tenant context), others are downstream
2. **Anti-Corruption Layer**: Infrastructure layer translates between contexts
3. **Shared Kernel**: shared/ contains types used by all contexts (Money, Quantity, VatRate)
4. **Event-Driven**: Contexts communicate via domain events where needed

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
