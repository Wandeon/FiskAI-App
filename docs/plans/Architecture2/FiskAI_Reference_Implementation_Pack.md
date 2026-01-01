# FiskAI Reference Implementation Pack

**Status:** Canonical  
**Purpose:** Eliminate ambiguity by example  
**Scope:** Patterns demonstrated here are the ONLY approved way to implement similar logic  
**Depends On:** All previous FiskAI canonical documents

---

## 0. Why This Document Exists

Rules alone are insufficient.

This document provides **canonical, copy-pasteable reference implementations** that define:

- how domain code is written
- how money is handled
- how aggregates protect invariants
- how repositories isolate infrastructure
- how use cases orchestrate behavior
- how correctness is proven via tests

If code deviates from these patterns without ADR approval, it is incorrect.

---

## 1. Money Value Object (Pure Domain)

**Location:** `src/domain/shared/Money.ts`  
**Dependencies:** `decimal.js` only

```ts
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
      throw new Error("Money.fromCents requires integer cents")
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

  multiply(factor: Decimal): Money {
    return new Money(this.amount.mul(factor), this.currency)
  }

  isNegative(): boolean {
    return this.amount.isNegative()
  }

  toDecimal(): Decimal {
    return this.amount
  }

  private assertSameCurrency(other: Money) {
    if (this.currency !== other.currency) {
      throw new Error("Currency mismatch")
    }
  }
}
```

---

## 2. Quantity Value Object

**Location:** `src/domain/shared/Quantity.ts`

```ts
export class Quantity {
  private constructor(private readonly value: number) {}

  static of(value: number): Quantity {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error("Quantity must be positive")
    }
    return new Quantity(value)
  }

  toNumber(): number {
    return this.value
  }
}
```

---

## 3. Invoice Aggregate (Rich Domain Model)

**Location:** `src/domain/invoicing/Invoice.ts`

```ts
import { Money } from "../shared/Money"
import { Quantity } from "../shared/Quantity"

export enum InvoiceStatus {
  DRAFT = "DRAFT",
  ISSUED = "ISSUED",
  FISCALIZED = "FISCALIZED",
  PAID = "PAID",
}

export class Invoice {
  private lines: InvoiceLine[] = []
  private status: InvoiceStatus = InvoiceStatus.DRAFT

  private constructor(private readonly id: string) {}

  static create(id: string): Invoice {
    return new Invoice(id)
  }

  addLine(description: string, qty: Quantity, unitPrice: Money): void {
    if (this.status !== InvoiceStatus.DRAFT) {
      throw new Error("Cannot modify invoice after issuing")
    }
    this.lines.push(new InvoiceLine(description, qty, unitPrice))
  }

  issue(): void {
    if (this.lines.length === 0) {
      throw new Error("Cannot issue empty invoice")
    }
    this.status = InvoiceStatus.ISSUED
  }

  getTotal(): Money {
    return this.lines.reduce((sum, l) => sum.add(l.total()), Money.zero())
  }

  getLines(): readonly InvoiceLine[] {
    return [...this.lines]
  }
}

class InvoiceLine {
  constructor(
    private readonly description: string,
    private readonly qty: Quantity,
    private readonly unitPrice: Money
  ) {}

  total(): Money {
    return this.unitPrice.multiply(new (require("decimal.js"))(this.qty.toNumber()))
  }
}
```

---

## 4. Repository Interface (Domain Port)

**Location:** `src/domain/invoicing/InvoiceRepository.ts`

```ts
import { Invoice } from "./Invoice"

export interface InvoiceRepository {
  save(invoice: Invoice): Promise<void>
  load(id: string): Promise<Invoice | null>
}
```

---

## 5. Prisma Repository Adapter (Infrastructure)

**Location:** `src/infrastructure/invoicing/PrismaInvoiceRepository.ts`

```ts
import { InvoiceRepository } from "@/domain/invoicing/InvoiceRepository"
import { Invoice } from "@/domain/invoicing/Invoice"
import { prisma } from "@/infrastructure/db"

export class PrismaInvoiceRepository implements InvoiceRepository {
  async save(invoice: Invoice): Promise<void> {
    // Map domain → DB here
    await prisma.invoice.upsert({
      /* mapping */
    })
  }

  async load(id: string): Promise<Invoice | null> {
    // Map DB → domain here
    return null
  }
}
```

---

## 6. Use Case (Application Layer)

**Location:** `src/application/invoicing/CreateInvoice.ts`

```ts
import { Invoice } from "@/domain/invoicing/Invoice"
import { InvoiceRepository } from "@/domain/invoicing/InvoiceRepository"

export class CreateInvoice {
  constructor(private readonly repo: InvoiceRepository) {}

  async execute(id: string): Promise<void> {
    const invoice = Invoice.create(id)
    await this.repo.save(invoice)
  }
}
```

---

## 7. API Adapter (Interfaces Layer)

**Location:** `src/interfaces/api/invoices/route.ts`

```ts
import { z } from "zod"
import { CreateInvoice } from "@/application/invoicing/CreateInvoice"

const schema = z.object({
  id: z.string().uuid(),
})

export async function POST(req: Request) {
  const data = schema.parse(await req.json())
  const useCase = new CreateInvoice(/* repo injected */)
  await useCase.execute(data.id)
  return new Response(null, { status: 201 })
}
```

---

## 8. Property-Based Test (Money Invariant)

**Location:** `src/domain/shared/__tests__/Money.property.test.ts`

```ts
import fc from "fast-check"
import { Money } from "../Money"

test("Money addition is commutative", () => {
  fc.assert(
    fc.property(fc.integer(), fc.integer(), (a, b) => {
      const m1 = Money.fromCents(a)
      const m2 = Money.fromCents(b)
      expect(m1.add(m2).toDecimal().equals(m2.add(m1).toDecimal())).toBe(true)
    })
  )
})
```

---

## 9. Golden Test (Regulated Output)

**Location:** `src/infrastructure/reports/__tests__/vat.golden.test.ts`

```ts
import { generateVatXml } from "../vat-generator"
import fs from "fs"

test("VAT XML output is stable", () => {
  const output = generateVatXml(/* fixture input */)
  const expected = fs.readFileSync(__dirname + "/fixtures/vat.xml", "utf8")
  expect(output).toBe(expected)
})
```

---

## 10. Final Rule

If an implementation does not resemble one of the patterns above:

- it is not compliant
- it must be refactored
- or justified via ADR

---

### End of Document 6

**This completes the FiskAI canonical documentation set**
