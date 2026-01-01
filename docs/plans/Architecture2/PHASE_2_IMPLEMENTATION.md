# Phase 2: Vertical Slice (Invoice) - Implementation Plan

**Status:** READY FOR EXECUTION (after Phase 1)
**Depends On:** Phase 1 Completion (Money, Quantity, VatRate value objects exist)
**Duration Estimate:** 4-5 focused sessions
**Goal:** Prove the full architecture end-to-end on the most critical domain

---

## 0. Phase 2 Objectives

1. Create the Invoice aggregate in `src/domain/invoicing/`
2. Create the InvoiceLine entity
3. Implement the invoice state machine with business verbs
4. Create use cases in `src/application/invoicing/`
5. Create repository interface and Prisma implementation
6. Create thin API adapters in `src/interfaces/invoicing/`
7. Prove the architecture works end-to-end

---

## 1. Current Invoice Code Locations

Based on codebase exploration:

| Current Location                       | Lines | Content                                  |
| -------------------------------------- | ----- | ---------------------------------------- |
| `src/lib/invoicing/models.ts`          | 6     | Anemic type aliases only                 |
| `src/lib/invoicing/events.ts`          | 72    | Event emission, revenue register         |
| `src/lib/invoice-numbering.ts`         | 295   | Sequential numbering logic               |
| `src/lib/invoice-status-validation.ts` | 65    | Status transition validation             |
| `src/app/actions/invoice.ts`           | 989   | All invoice business logic mixed with DB |
| `src/lib/validations/e-invoice.ts`     | 37    | Zod schemas for input validation         |

**Problem:** The 989-line `invoice.ts` action file contains:

- Business rules (should be domain)
- Database access (should be infrastructure)
- VAT calculations (should use domain Money/VatCalculator)
- Email sending (should be infrastructure)
- PDF generation (should be infrastructure)

---

## 2. Create Invoice Aggregate

### 2.1 Create `src/domain/invoicing/InvoiceId.ts`

```typescript
// src/domain/invoicing/InvoiceId.ts
export class InvoiceId {
  private constructor(private readonly value: string) {}

  static create(): InvoiceId {
    return new InvoiceId(crypto.randomUUID())
  }

  static fromString(value: string): InvoiceId {
    if (!value || value.trim() === "") {
      throw new InvoiceError("Invoice ID cannot be empty")
    }
    return new InvoiceId(value)
  }

  toString(): string {
    return this.value
  }

  equals(other: InvoiceId): boolean {
    return this.value === other.value
  }
}
```

### 2.2 Create `src/domain/invoicing/InvoiceNumber.ts`

```typescript
// src/domain/invoicing/InvoiceNumber.ts

/**
 * Croatian invoice number format: broj-prostor-uređaj
 * Example: 43-1-1 (invoice 43, premise 1, device 1)
 */
export class InvoiceNumber {
  private constructor(
    public readonly sequenceNumber: number,
    public readonly premiseCode: number,
    public readonly deviceCode: number,
    public readonly year: number
  ) {}

  static create(
    sequenceNumber: number,
    premiseCode: number,
    deviceCode: number,
    year: number
  ): InvoiceNumber {
    if (sequenceNumber <= 0) {
      throw new InvoiceError("Sequence number must be positive")
    }
    if (premiseCode <= 0) {
      throw new InvoiceError("Premise code must be positive")
    }
    if (deviceCode <= 0) {
      throw new InvoiceError("Device code must be positive")
    }
    return new InvoiceNumber(sequenceNumber, premiseCode, deviceCode, year)
  }

  static parse(value: string): InvoiceNumber {
    const regex = /^(\d+)-(\d+)-(\d+)$/
    const match = value.match(regex)
    if (!match) {
      throw new InvoiceError(`Invalid invoice number format: ${value}`)
    }
    const [, seq, premise, device] = match
    return new InvoiceNumber(
      parseInt(seq, 10),
      parseInt(premise, 10),
      parseInt(device, 10),
      new Date().getFullYear()
    )
  }

  format(): string {
    return `${this.sequenceNumber}-${this.premiseCode}-${this.deviceCode}`
  }

  formatWithYear(): string {
    return `${this.format()}/${this.year}`
  }
}
```

### 2.3 Create `src/domain/invoicing/InvoiceStatus.ts`

```typescript
// src/domain/invoicing/InvoiceStatus.ts

export enum InvoiceStatus {
  DRAFT = "DRAFT",
  PENDING_FISCALIZATION = "PENDING_FISCALIZATION",
  FISCALIZED = "FISCALIZED",
  SENT = "SENT",
  DELIVERED = "DELIVERED",
  ACCEPTED = "ACCEPTED",
  CANCELED = "CANCELED",
  ARCHIVED = "ARCHIVED",
}

const VALID_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  [InvoiceStatus.DRAFT]: [InvoiceStatus.PENDING_FISCALIZATION, InvoiceStatus.CANCELED],
  [InvoiceStatus.PENDING_FISCALIZATION]: [InvoiceStatus.FISCALIZED, InvoiceStatus.DRAFT],
  [InvoiceStatus.FISCALIZED]: [InvoiceStatus.SENT],
  [InvoiceStatus.SENT]: [InvoiceStatus.DELIVERED, InvoiceStatus.ACCEPTED],
  [InvoiceStatus.DELIVERED]: [InvoiceStatus.ACCEPTED],
  [InvoiceStatus.ACCEPTED]: [InvoiceStatus.ARCHIVED],
  [InvoiceStatus.CANCELED]: [],
  [InvoiceStatus.ARCHIVED]: [],
}

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to)
}

export function isTerminal(status: InvoiceStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0
}
```

### 2.4 Create `src/domain/invoicing/InvoiceLine.ts`

```typescript
// src/domain/invoicing/InvoiceLine.ts
import { Money } from "@/domain/shared"
import { Quantity } from "@/domain/shared"
import { VatRate } from "@/domain/shared"

export class InvoiceLine {
  private constructor(
    public readonly id: string,
    public readonly description: string,
    public readonly quantity: Quantity,
    public readonly unitPrice: Money,
    public readonly vatRate: VatRate,
    public readonly discount: Money = Money.zero()
  ) {}

  static create(params: {
    id?: string
    description: string
    quantity: Quantity
    unitPrice: Money
    vatRate: VatRate
    discount?: Money
  }): InvoiceLine {
    if (!params.description || params.description.trim() === "") {
      throw new InvoiceError("Line description cannot be empty")
    }

    return new InvoiceLine(
      params.id || crypto.randomUUID(),
      params.description.trim(),
      params.quantity,
      params.unitPrice,
      params.vatRate,
      params.discount || Money.zero()
    )
  }

  /**
   * Line net total = (unitPrice * quantity) - discount
   */
  netTotal(): Money {
    const gross = this.unitPrice.multiply(this.quantity.toDecimal())
    return gross.subtract(this.discount).round()
  }

  /**
   * Line VAT amount
   */
  vatAmount(): Money {
    return this.vatRate.calculateVat(this.netTotal())
  }

  /**
   * Line gross total = net + VAT
   */
  grossTotal(): Money {
    return this.netTotal().add(this.vatAmount())
  }
}
```

### 2.5 Create `src/domain/invoicing/Invoice.ts` (The Aggregate)

```typescript
// src/domain/invoicing/Invoice.ts
import { Money } from "@/domain/shared"
import { InvoiceId } from "./InvoiceId"
import { InvoiceNumber } from "./InvoiceNumber"
import { InvoiceStatus, canTransition, isTerminal } from "./InvoiceStatus"
import { InvoiceLine } from "./InvoiceLine"
import { InvoiceError } from "./InvoiceError"

export interface InvoiceProps {
  id: InvoiceId
  invoiceNumber?: InvoiceNumber
  status: InvoiceStatus
  buyerId: string
  sellerId: string
  issueDate?: Date
  dueDate?: Date
  lines: InvoiceLine[]
  jir?: string // Fiscal JIR
  zki?: string // Fiscal ZKI
  fiscalizedAt?: Date
  version: number
}

export class Invoice {
  private props: InvoiceProps

  private constructor(props: InvoiceProps) {
    this.props = props
  }

  // ===== CREATION =====

  static create(buyerId: string, sellerId: string): Invoice {
    return new Invoice({
      id: InvoiceId.create(),
      status: InvoiceStatus.DRAFT,
      buyerId,
      sellerId,
      lines: [],
      version: 1,
    })
  }

  static reconstitute(props: InvoiceProps): Invoice {
    return new Invoice(props)
  }

  // ===== GETTERS =====

  get id(): InvoiceId {
    return this.props.id
  }

  get status(): InvoiceStatus {
    return this.props.status
  }

  get invoiceNumber(): InvoiceNumber | undefined {
    return this.props.invoiceNumber
  }

  get buyerId(): string {
    return this.props.buyerId
  }

  get sellerId(): string {
    return this.props.sellerId
  }

  get issueDate(): Date | undefined {
    return this.props.issueDate
  }

  get dueDate(): Date | undefined {
    return this.props.dueDate
  }

  get jir(): string | undefined {
    return this.props.jir
  }

  get zki(): string | undefined {
    return this.props.zki
  }

  get version(): number {
    return this.props.version
  }

  getLines(): readonly InvoiceLine[] {
    return [...this.props.lines]
  }

  // ===== CALCULATIONS =====

  netTotal(): Money {
    return this.props.lines.reduce((sum, line) => sum.add(line.netTotal()), Money.zero())
  }

  vatTotal(): Money {
    return this.props.lines.reduce((sum, line) => sum.add(line.vatAmount()), Money.zero())
  }

  grossTotal(): Money {
    return this.netTotal().add(this.vatTotal())
  }

  // ===== BUSINESS VERBS =====

  addLine(line: InvoiceLine): void {
    this.assertDraft("add line")
    this.props.lines.push(line)
    this.props.version++
  }

  removeLine(lineId: string): void {
    this.assertDraft("remove line")
    const index = this.props.lines.findIndex((l) => l.id === lineId)
    if (index === -1) {
      throw new InvoiceError(`Line ${lineId} not found`)
    }
    this.props.lines.splice(index, 1)
    this.props.version++
  }

  updateBuyer(buyerId: string): void {
    this.assertDraft("update buyer")
    this.props.buyerId = buyerId
    this.props.version++
  }

  /**
   * Issue the invoice - assigns number and prepares for fiscalization
   */
  issue(invoiceNumber: InvoiceNumber, issueDate: Date, dueDate: Date): void {
    this.assertDraft("issue")

    if (this.props.lines.length === 0) {
      throw new InvoiceError("Cannot issue invoice with no lines")
    }

    if (dueDate < issueDate) {
      throw new InvoiceError("Due date cannot be before issue date")
    }

    this.props.invoiceNumber = invoiceNumber
    this.props.issueDate = issueDate
    this.props.dueDate = dueDate
    this.transitionTo(InvoiceStatus.PENDING_FISCALIZATION)
  }

  /**
   * Record fiscalization result
   */
  fiscalize(jir: string, zki: string): void {
    this.assertStatus(InvoiceStatus.PENDING_FISCALIZATION, "fiscalize")

    if (!jir || jir.trim() === "") {
      throw new InvoiceError("JIR cannot be empty")
    }
    if (!zki || zki.trim() === "") {
      throw new InvoiceError("ZKI cannot be empty")
    }

    this.props.jir = jir
    this.props.zki = zki
    this.props.fiscalizedAt = new Date()
    this.transitionTo(InvoiceStatus.FISCALIZED)
  }

  /**
   * Mark as sent to buyer
   */
  markSent(): void {
    this.assertStatus(InvoiceStatus.FISCALIZED, "mark sent")
    this.transitionTo(InvoiceStatus.SENT)
  }

  /**
   * Mark as delivered
   */
  markDelivered(): void {
    this.assertStatus(InvoiceStatus.SENT, "mark delivered")
    this.transitionTo(InvoiceStatus.DELIVERED)
  }

  /**
   * Mark as accepted/paid
   */
  accept(): void {
    if (this.props.status !== InvoiceStatus.SENT && this.props.status !== InvoiceStatus.DELIVERED) {
      throw new InvoiceError(`Cannot accept invoice in ${this.props.status} status`)
    }
    this.transitionTo(InvoiceStatus.ACCEPTED)
  }

  /**
   * Archive the invoice
   */
  archive(): void {
    this.assertStatus(InvoiceStatus.ACCEPTED, "archive")
    this.transitionTo(InvoiceStatus.ARCHIVED)
  }

  /**
   * Cancel draft invoice
   */
  cancel(): void {
    this.assertDraft("cancel")
    this.transitionTo(InvoiceStatus.CANCELED)
  }

  // ===== INVARIANT ENFORCEMENT =====

  private assertDraft(action: string): void {
    if (this.props.status !== InvoiceStatus.DRAFT) {
      throw new InvoiceError(
        `Cannot ${action}: invoice is not in DRAFT status (current: ${this.props.status})`
      )
    }
  }

  private assertStatus(expected: InvoiceStatus, action: string): void {
    if (this.props.status !== expected) {
      throw new InvoiceError(`Cannot ${action}: expected ${expected}, got ${this.props.status}`)
    }
  }

  private transitionTo(newStatus: InvoiceStatus): void {
    if (!canTransition(this.props.status, newStatus)) {
      throw new InvoiceError(`Invalid status transition: ${this.props.status} → ${newStatus}`)
    }
    this.props.status = newStatus
    this.props.version++
  }
}
```

### 2.6 Create `src/domain/invoicing/InvoiceError.ts`

```typescript
// src/domain/invoicing/InvoiceError.ts
export class InvoiceError extends Error {
  readonly code = "INVOICE_ERROR"

  constructor(message: string) {
    super(message)
    this.name = "InvoiceError"
  }
}
```

### 2.7 Create `src/domain/invoicing/index.ts`

```typescript
// src/domain/invoicing/index.ts
export { Invoice, type InvoiceProps } from "./Invoice"
export { InvoiceId } from "./InvoiceId"
export { InvoiceNumber } from "./InvoiceNumber"
export { InvoiceStatus, canTransition, isTerminal } from "./InvoiceStatus"
export { InvoiceLine } from "./InvoiceLine"
export { InvoiceError } from "./InvoiceError"
```

---

## 3. Create Repository Interface (Domain Port)

### 3.1 Create `src/domain/invoicing/InvoiceRepository.ts`

```typescript
// src/domain/invoicing/InvoiceRepository.ts
import { Invoice } from "./Invoice"
import { InvoiceId } from "./InvoiceId"

export interface InvoiceRepository {
  save(invoice: Invoice): Promise<void>
  findById(id: InvoiceId): Promise<Invoice | null>
  findByNumber(number: string, companyId: string): Promise<Invoice | null>
  nextSequenceNumber(companyId: string, premiseCode: number, deviceCode: number): Promise<number>
}
```

---

## 4. Create Application Use Cases

### 4.1 Create `src/application/invoicing/CreateInvoice.ts`

```typescript
// src/application/invoicing/CreateInvoice.ts
import { Invoice } from "@/domain/invoicing"
import { InvoiceRepository } from "@/domain/invoicing/InvoiceRepository"

export interface CreateInvoiceInput {
  buyerId: string
  sellerId: string
}

export interface CreateInvoiceOutput {
  invoiceId: string
}

export class CreateInvoice {
  constructor(private readonly repo: InvoiceRepository) {}

  async execute(input: CreateInvoiceInput): Promise<CreateInvoiceOutput> {
    const invoice = Invoice.create(input.buyerId, input.sellerId)
    await this.repo.save(invoice)

    return {
      invoiceId: invoice.id.toString(),
    }
  }
}
```

### 4.2 Create `src/application/invoicing/AddInvoiceLine.ts`

```typescript
// src/application/invoicing/AddInvoiceLine.ts
import { InvoiceRepository } from "@/domain/invoicing/InvoiceRepository"
import { InvoiceId, InvoiceLine } from "@/domain/invoicing"
import { Money, Quantity, VatRate } from "@/domain/shared"

export interface AddInvoiceLineInput {
  invoiceId: string
  description: string
  quantity: number
  unitPriceCents: number
  vatRatePercent: number
  discountCents?: number
}

export class AddInvoiceLine {
  constructor(private readonly repo: InvoiceRepository) {}

  async execute(input: AddInvoiceLineInput): Promise<void> {
    const invoice = await this.repo.findById(InvoiceId.fromString(input.invoiceId))
    if (!invoice) {
      throw new Error(`Invoice ${input.invoiceId} not found`)
    }

    const line = InvoiceLine.create({
      description: input.description,
      quantity: Quantity.of(input.quantity),
      unitPrice: Money.fromCents(input.unitPriceCents),
      vatRate: VatRate.standard(input.vatRatePercent / 100),
      discount: input.discountCents ? Money.fromCents(input.discountCents) : undefined,
    })

    invoice.addLine(line)
    await this.repo.save(invoice)
  }
}
```

### 4.3 Create `src/application/invoicing/IssueInvoice.ts`

```typescript
// src/application/invoicing/IssueInvoice.ts
import { InvoiceRepository } from "@/domain/invoicing/InvoiceRepository"
import { InvoiceId, InvoiceNumber } from "@/domain/invoicing"

export interface IssueInvoiceInput {
  invoiceId: string
  companyId: string
  premiseCode: number
  deviceCode: number
  dueDate: Date
}

export interface IssueInvoiceOutput {
  invoiceNumber: string
}

export class IssueInvoice {
  constructor(private readonly repo: InvoiceRepository) {}

  async execute(input: IssueInvoiceInput): Promise<IssueInvoiceOutput> {
    const invoice = await this.repo.findById(InvoiceId.fromString(input.invoiceId))
    if (!invoice) {
      throw new Error(`Invoice ${input.invoiceId} not found`)
    }

    const sequenceNumber = await this.repo.nextSequenceNumber(
      input.companyId,
      input.premiseCode,
      input.deviceCode
    )

    const invoiceNumber = InvoiceNumber.create(
      sequenceNumber,
      input.premiseCode,
      input.deviceCode,
      new Date().getFullYear()
    )

    invoice.issue(invoiceNumber, new Date(), input.dueDate)
    await this.repo.save(invoice)

    return {
      invoiceNumber: invoiceNumber.format(),
    }
  }
}
```

### 4.4 Create `src/application/invoicing/index.ts`

```typescript
// src/application/invoicing/index.ts
export { CreateInvoice, type CreateInvoiceInput, type CreateInvoiceOutput } from "./CreateInvoice"
export { AddInvoiceLine, type AddInvoiceLineInput } from "./AddInvoiceLine"
export { IssueInvoice, type IssueInvoiceInput, type IssueInvoiceOutput } from "./IssueInvoice"
```

---

## 5. Create Infrastructure Repository

### 5.1 Create `src/infrastructure/invoicing/PrismaInvoiceRepository.ts`

```typescript
// src/infrastructure/invoicing/PrismaInvoiceRepository.ts
import { InvoiceRepository } from "@/domain/invoicing/InvoiceRepository"
import { Invoice, InvoiceId, InvoiceNumber, InvoiceStatus, InvoiceLine } from "@/domain/invoicing"
import { Money, Quantity, VatRate } from "@/domain/shared"
import { prisma } from "@/lib/db"
import { MoneyMapper } from "@/infrastructure/mappers/MoneyMapper"

export class PrismaInvoiceRepository implements InvoiceRepository {
  async save(invoice: Invoice): Promise<void> {
    const lines = invoice.getLines()

    await prisma.eInvoice.upsert({
      where: { id: invoice.id.toString() },
      create: {
        id: invoice.id.toString(),
        invoiceNumber: invoice.invoiceNumber?.format() ?? null,
        status: invoice.status,
        buyerId: invoice.buyerId,
        sellerId: invoice.sellerId,
        issueDate: invoice.issueDate ?? null,
        dueDate: invoice.dueDate ?? null,
        netAmount: MoneyMapper.toPrismaDecimal(invoice.netTotal()),
        taxAmount: MoneyMapper.toPrismaDecimal(invoice.vatTotal()),
        totalAmount: MoneyMapper.toPrismaDecimal(invoice.grossTotal()),
        jir: invoice.jir ?? null,
        zki: invoice.zki ?? null,
        version: invoice.version,
        lines: {
          create: lines.map((line) => this.mapLineToPersistence(line)),
        },
      },
      update: {
        invoiceNumber: invoice.invoiceNumber?.format() ?? null,
        status: invoice.status,
        buyerId: invoice.buyerId,
        issueDate: invoice.issueDate ?? null,
        dueDate: invoice.dueDate ?? null,
        netAmount: MoneyMapper.toPrismaDecimal(invoice.netTotal()),
        taxAmount: MoneyMapper.toPrismaDecimal(invoice.vatTotal()),
        totalAmount: MoneyMapper.toPrismaDecimal(invoice.grossTotal()),
        jir: invoice.jir ?? null,
        zki: invoice.zki ?? null,
        version: invoice.version,
        // Note: line updates would need upsert logic
      },
    })
  }

  async findById(id: InvoiceId): Promise<Invoice | null> {
    const record = await prisma.eInvoice.findUnique({
      where: { id: id.toString() },
      include: { lines: true },
    })

    if (!record) return null

    return this.mapToDomain(record)
  }

  async findByNumber(number: string, companyId: string): Promise<Invoice | null> {
    const record = await prisma.eInvoice.findFirst({
      where: {
        invoiceNumber: number,
        sellerId: companyId,
      },
      include: { lines: true },
    })

    if (!record) return null

    return this.mapToDomain(record)
  }

  async nextSequenceNumber(
    companyId: string,
    premiseCode: number,
    deviceCode: number
  ): Promise<number> {
    // Use existing invoice-numbering logic or implement atomic increment
    const result = await prisma.invoiceSequence.upsert({
      where: {
        companyId_premiseCode_deviceCode_year: {
          companyId,
          premiseCode,
          deviceCode,
          year: new Date().getFullYear(),
        },
      },
      create: {
        companyId,
        premiseCode,
        deviceCode,
        year: new Date().getFullYear(),
        lastNumber: 1,
      },
      update: {
        lastNumber: { increment: 1 },
      },
    })

    return result.lastNumber
  }

  private mapToDomain(record: any): Invoice {
    const lines = record.lines.map((line: any) =>
      InvoiceLine.create({
        id: line.id,
        description: line.description,
        quantity: Quantity.of(line.quantity),
        unitPrice: MoneyMapper.fromPrismaDecimal(line.unitPrice),
        vatRate: VatRate.standard(line.vatRate.toString()),
      })
    )

    return Invoice.reconstitute({
      id: InvoiceId.fromString(record.id),
      invoiceNumber: record.invoiceNumber ? InvoiceNumber.parse(record.invoiceNumber) : undefined,
      status: record.status as InvoiceStatus,
      buyerId: record.buyerId,
      sellerId: record.sellerId,
      issueDate: record.issueDate ?? undefined,
      dueDate: record.dueDate ?? undefined,
      lines,
      jir: record.jir ?? undefined,
      zki: record.zki ?? undefined,
      fiscalizedAt: record.fiscalizedAt ?? undefined,
      version: record.version,
    })
  }

  private mapLineToPersistence(line: InvoiceLine) {
    return {
      id: line.id,
      description: line.description,
      quantity: line.quantity.toNumber(),
      unitPrice: MoneyMapper.toPrismaDecimal(line.unitPrice),
      vatRate: line.vatRate.rateAsDecimal(),
      netAmount: MoneyMapper.toPrismaDecimal(line.netTotal()),
      taxAmount: MoneyMapper.toPrismaDecimal(line.vatAmount()),
      totalAmount: MoneyMapper.toPrismaDecimal(line.grossTotal()),
    }
  }
}
```

---

## 6. Create Interface Adapter

### 6.1 Create `src/interfaces/invoicing/CreateInvoiceAdapter.ts`

```typescript
// src/interfaces/invoicing/CreateInvoiceAdapter.ts
import { z } from "zod"
import { CreateInvoice } from "@/application/invoicing"
import { PrismaInvoiceRepository } from "@/infrastructure/invoicing/PrismaInvoiceRepository"

const CreateInvoiceSchema = z.object({
  buyerId: z.string().uuid(),
  sellerId: z.string().uuid(),
})

export async function handleCreateInvoice(input: unknown) {
  // 1. Validate at boundary
  const validated = CreateInvoiceSchema.parse(input)

  // 2. Create use case with injected dependencies
  const repo = new PrismaInvoiceRepository()
  const useCase = new CreateInvoice(repo)

  // 3. Execute
  const result = await useCase.execute(validated)

  // 4. Return
  return result
}
```

---

## 7. Tests

### 7.1 Unit Tests for Invoice Aggregate

**`src/domain/invoicing/__tests__/Invoice.test.ts`:**

```typescript
import { describe, it, expect } from "vitest"
import { Invoice, InvoiceNumber, InvoiceLine, InvoiceStatus, InvoiceError } from "../"
import { Money, Quantity, VatRate } from "@/domain/shared"

describe("Invoice", () => {
  const createLine = () =>
    InvoiceLine.create({
      description: "Test item",
      quantity: Quantity.of(2),
      unitPrice: Money.fromCents(10000), // 100.00 EUR
      vatRate: VatRate.standard(0.25),
    })

  describe("creation", () => {
    it("creates a draft invoice", () => {
      const invoice = Invoice.create("buyer-id", "seller-id")
      expect(invoice.status).toBe(InvoiceStatus.DRAFT)
      expect(invoice.getLines()).toHaveLength(0)
    })
  })

  describe("adding lines", () => {
    it("allows adding lines to draft", () => {
      const invoice = Invoice.create("buyer", "seller")
      invoice.addLine(createLine())
      expect(invoice.getLines()).toHaveLength(1)
    })

    it("calculates totals correctly", () => {
      const invoice = Invoice.create("buyer", "seller")
      invoice.addLine(createLine())

      // 2 * 100.00 = 200.00 net
      // 200.00 * 0.25 = 50.00 VAT
      // Total = 250.00
      expect(invoice.netTotal().toCents()).toBe(20000)
      expect(invoice.vatTotal().toCents()).toBe(5000)
      expect(invoice.grossTotal().toCents()).toBe(25000)
    })
  })

  describe("issuing", () => {
    it("cannot issue empty invoice", () => {
      const invoice = Invoice.create("buyer", "seller")
      const number = InvoiceNumber.create(1, 1, 1, 2025)

      expect(() => invoice.issue(number, new Date(), new Date())).toThrow(InvoiceError)
    })

    it("issues invoice with number", () => {
      const invoice = Invoice.create("buyer", "seller")
      invoice.addLine(createLine())

      const number = InvoiceNumber.create(1, 1, 1, 2025)
      const issueDate = new Date()
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      invoice.issue(number, issueDate, dueDate)

      expect(invoice.status).toBe(InvoiceStatus.PENDING_FISCALIZATION)
      expect(invoice.invoiceNumber?.format()).toBe("1-1-1")
    })
  })

  describe("status transitions", () => {
    it("follows valid state machine", () => {
      const invoice = Invoice.create("buyer", "seller")
      invoice.addLine(createLine())

      const number = InvoiceNumber.create(1, 1, 1, 2025)
      invoice.issue(number, new Date(), new Date(Date.now() + 86400000))
      expect(invoice.status).toBe(InvoiceStatus.PENDING_FISCALIZATION)

      invoice.fiscalize("JIR-123", "ZKI-456")
      expect(invoice.status).toBe(InvoiceStatus.FISCALIZED)

      invoice.markSent()
      expect(invoice.status).toBe(InvoiceStatus.SENT)

      invoice.accept()
      expect(invoice.status).toBe(InvoiceStatus.ACCEPTED)
    })

    it("rejects invalid transitions", () => {
      const invoice = Invoice.create("buyer", "seller")

      // Cannot fiscalize a draft
      expect(() => invoice.fiscalize("JIR", "ZKI")).toThrow(InvoiceError)
    })
  })
})
```

---

## 8. Exit Criteria

Phase 2 is complete when:

- [ ] `src/domain/invoicing/Invoice.ts` aggregate exists with business verbs
- [ ] `src/domain/invoicing/InvoiceLine.ts` entity uses Money/Quantity/VatRate
- [ ] `src/domain/invoicing/InvoiceStatus.ts` state machine enforces transitions
- [ ] `src/application/invoicing/` has use cases (CreateInvoice, AddInvoiceLine, IssueInvoice)
- [ ] `src/infrastructure/invoicing/PrismaInvoiceRepository.ts` implements repository
- [ ] `src/interfaces/invoicing/` has thin adapters with Zod validation
- [ ] Unit tests for aggregate pass
- [ ] No DB access in domain layer (ESLint enforces)
- [ ] One end-to-end invoice creation flow works through all layers

---

## 9. What Phase 2 Does NOT Include

- Migrating the existing 989-line `invoice.ts` (that happens gradually)
- Fiscalization integration (that's Phase 3)
- PDF generation refactoring (infrastructure concern)
- Email sending refactoring (infrastructure concern)
- All invoice features (just core create/issue flow)

Phase 2 proves the architecture works. Subsequent phases migrate remaining features.

---

**Next Document:** Phase 3 Implementation Plan (Fiscalization & Tax)
