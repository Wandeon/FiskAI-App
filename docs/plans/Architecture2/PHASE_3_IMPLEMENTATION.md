# Phase 3: Fiscalization & Tax - Implementation Plan

**Status:** READY FOR EXECUTION (after Phase 2)
**Depends On:** Phase 2 Completion (Invoice aggregate, Money value objects)
**Duration Estimate:** 4-5 focused sessions
**Goal:** Bring regulated fiscalization and tax logic under strict domain control

---

## 0. Phase 3 Objectives

1. Model fiscalization as explicit domain state machine
2. Implement VAT calculator in domain layer (using Money)
3. Create ZKI calculation as pure domain function
4. Add golden tests for fiscal XML output
5. Add idempotency to all fiscal submissions
6. Create property-based tests for VAT invariants

---

## 1. Current Fiscalization Code Locations

Based on codebase exploration:

| Current Location                       | Lines | Content                                             | Target                         |
| -------------------------------------- | ----- | --------------------------------------------------- | ------------------------------ |
| `src/lib/fiscal/fiscal-pipeline.ts`    | 184   | Core pipeline: validation, XML, signing, submission | Split: domain + infrastructure |
| `src/lib/fiscal/xml-builder.ts`        | 205   | Builds fiscal XML                                   | `src/infrastructure/fiscal/`   |
| `src/lib/fiscal/xml-signer.ts`         | 50    | Signs XML with certificate                          | `src/infrastructure/fiscal/`   |
| `src/lib/fiscal/porezna-client.ts`     | 160   | SOAP client for Porezna                             | `src/infrastructure/fiscal/`   |
| `src/lib/fiscal/certificate-parser.ts` | 138   | P12 parsing                                         | `src/infrastructure/fiscal/`   |
| `src/lib/fiscal/qr-generator.ts`       | 84    | QR code generation                                  | `src/infrastructure/fiscal/`   |
| `src/lib/fiscal/should-fiscalize.ts`   | 149   | Decision logic                                      | `src/domain/fiscalization/`    |
| `src/lib/e-invoice/zki.ts`             | 126   | ZKI calculation (SHA256)                            | `src/domain/fiscalization/`    |
| `src/lib/fiscal-rules/service.ts`      | 317   | VAT calculation (VIOLATES - uses floats)            | `src/domain/tax/`              |
| `src/lib/vat/input-vat.ts`             | 142   | Input VAT deductibility                             | `src/domain/tax/`              |
| `src/lib/vat/output-calculator.ts`     | 90    | Output VAT resolution                               | `src/domain/tax/`              |

---

## 2. Create Fiscalization Domain

### 2.1 Create `src/domain/fiscalization/FiscalStatus.ts`

```typescript
// src/domain/fiscalization/FiscalStatus.ts

export enum FiscalStatus {
  NOT_REQUIRED = "NOT_REQUIRED", // Non-cash payment, no fiscalization needed
  PENDING = "PENDING", // Queued for fiscalization
  SUBMITTING = "SUBMITTING", // Currently being submitted
  FISCALIZED = "FISCALIZED", // Successfully fiscalized (has JIR)
  FAILED = "FAILED", // Failed, needs retry
  RETRY_SCHEDULED = "RETRY_SCHEDULED", // Scheduled for retry
  DEADLINE_EXCEEDED = "DEADLINE_EXCEEDED", // 48h deadline passed
}

const VALID_TRANSITIONS: Record<FiscalStatus, FiscalStatus[]> = {
  [FiscalStatus.NOT_REQUIRED]: [],
  [FiscalStatus.PENDING]: [FiscalStatus.SUBMITTING, FiscalStatus.FAILED],
  [FiscalStatus.SUBMITTING]: [FiscalStatus.FISCALIZED, FiscalStatus.FAILED],
  [FiscalStatus.FAILED]: [FiscalStatus.RETRY_SCHEDULED, FiscalStatus.DEADLINE_EXCEEDED],
  [FiscalStatus.RETRY_SCHEDULED]: [FiscalStatus.SUBMITTING],
  [FiscalStatus.FISCALIZED]: [],
  [FiscalStatus.DEADLINE_EXCEEDED]: [],
}

export function canTransitionFiscal(from: FiscalStatus, to: FiscalStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to)
}

export function isTerminalFiscal(status: FiscalStatus): boolean {
  return [
    FiscalStatus.NOT_REQUIRED,
    FiscalStatus.FISCALIZED,
    FiscalStatus.DEADLINE_EXCEEDED,
  ].includes(status)
}
```

### 2.2 Create `src/domain/fiscalization/FiscalRequest.ts`

```typescript
// src/domain/fiscalization/FiscalRequest.ts
import { Money } from "@/domain/shared"
import { FiscalStatus, canTransitionFiscal } from "./FiscalStatus"

export interface FiscalRequestProps {
  id: string
  invoiceId: string
  commandId: string // Idempotency key
  status: FiscalStatus
  zki: string
  jir?: string
  attemptCount: number
  lastAttemptAt?: Date
  nextRetryAt?: Date
  errorCode?: string
  errorMessage?: string
  createdAt: Date
  fiscalizedAt?: Date
}

export class FiscalRequest {
  private props: FiscalRequestProps

  private constructor(props: FiscalRequestProps) {
    this.props = props
  }

  static create(invoiceId: string, commandId: string, zki: string): FiscalRequest {
    return new FiscalRequest({
      id: crypto.randomUUID(),
      invoiceId,
      commandId,
      status: FiscalStatus.PENDING,
      zki,
      attemptCount: 0,
      createdAt: new Date(),
    })
  }

  static reconstitute(props: FiscalRequestProps): FiscalRequest {
    return new FiscalRequest(props)
  }

  // Getters
  get id(): string {
    return this.props.id
  }
  get invoiceId(): string {
    return this.props.invoiceId
  }
  get commandId(): string {
    return this.props.commandId
  }
  get status(): FiscalStatus {
    return this.props.status
  }
  get zki(): string {
    return this.props.zki
  }
  get jir(): string | undefined {
    return this.props.jir
  }
  get attemptCount(): number {
    return this.props.attemptCount
  }

  // Business methods
  markSubmitting(): void {
    this.transitionTo(FiscalStatus.SUBMITTING)
    this.props.attemptCount++
    this.props.lastAttemptAt = new Date()
  }

  recordSuccess(jir: string): void {
    if (!jir || jir.trim() === "") {
      throw new FiscalError("JIR cannot be empty")
    }
    this.props.jir = jir
    this.props.fiscalizedAt = new Date()
    this.transitionTo(FiscalStatus.FISCALIZED)
  }

  recordFailure(errorCode: string, errorMessage: string): void {
    this.props.errorCode = errorCode
    this.props.errorMessage = errorMessage
    this.transitionTo(FiscalStatus.FAILED)
  }

  scheduleRetry(nextRetryAt: Date): void {
    if (this.isDeadlineExceeded()) {
      this.transitionTo(FiscalStatus.DEADLINE_EXCEEDED)
      return
    }
    this.props.nextRetryAt = nextRetryAt
    this.transitionTo(FiscalStatus.RETRY_SCHEDULED)
  }

  private isDeadlineExceeded(): boolean {
    const deadline = new Date(this.props.createdAt)
    deadline.setHours(deadline.getHours() + 48)
    return new Date() > deadline
  }

  private transitionTo(newStatus: FiscalStatus): void {
    if (!canTransitionFiscal(this.props.status, newStatus)) {
      throw new FiscalError(`Invalid fiscal status transition: ${this.props.status} → ${newStatus}`)
    }
    this.props.status = newStatus
  }
}

export class FiscalError extends Error {
  readonly code = "FISCAL_ERROR"
  constructor(message: string) {
    super(message)
    this.name = "FiscalError"
  }
}
```

### 2.3 Create `src/domain/fiscalization/ZkiCalculator.ts`

This is pure domain logic - no crypto dependencies (those go in infrastructure):

```typescript
// src/domain/fiscalization/ZkiCalculator.ts
import { Money } from "@/domain/shared"

export interface ZkiInput {
  oib: string // Company OIB (11 digits)
  invoiceNumber: string // Format: broj-prostor-uređaj
  totalAmount: Money // Gross amount
  issueDateTime: Date // Issue timestamp
}

/**
 * Builds the ZKI input string per Croatian fiscalization spec.
 * The actual SHA256 hash + RSA signing happens in infrastructure.
 */
export function buildZkiString(input: ZkiInput): string {
  validateOib(input.oib)

  const dateStr = formatZkiDateTime(input.issueDateTime)
  const amountStr = formatZkiAmount(input.totalAmount)

  // Croatian fiscalization spec: OIB + DateTime + InvoiceNumber + Amount
  return `${input.oib}${dateStr}${input.invoiceNumber}${amountStr}`
}

function validateOib(oib: string): void {
  if (!/^\d{11}$/.test(oib)) {
    throw new Error("OIB must be exactly 11 digits")
  }
}

function formatZkiDateTime(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0")
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const year = date.getFullYear()
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  const seconds = date.getSeconds().toString().padStart(2, "0")
  return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`
}

function formatZkiAmount(amount: Money): string {
  // Croatian format: no thousands separator, comma for decimals
  const decimal = amount.toDecimal()
  const [intPart, decPart = "00"] = decimal.toFixed(2).split(".")
  return `${intPart},${decPart}`
}
```

### 2.4 Create `src/domain/fiscalization/ShouldFiscalize.ts`

```typescript
// src/domain/fiscalization/ShouldFiscalize.ts

export enum PaymentMethod {
  CASH = "G", // Gotovina
  CARD = "K", // Kartica
  TRANSFER = "T", // Transakcijski račun
  CHECK = "C", // Ček
  OTHER = "O", // Ostalo
}

export interface FiscalizationContext {
  paymentMethod: PaymentMethod
  isFiscalizationEnabled: boolean
  hasCertificate: boolean
  isCertificateValid: boolean
}

/**
 * Pure domain logic to determine if an invoice requires fiscalization.
 * Per Croatian law, only CASH and CARD payments require fiscalization.
 */
export function shouldFiscalize(ctx: FiscalizationContext): boolean {
  // Not enabled for this company
  if (!ctx.isFiscalizationEnabled) {
    return false
  }

  // Only cash and card payments require fiscalization
  if (ctx.paymentMethod !== PaymentMethod.CASH && ctx.paymentMethod !== PaymentMethod.CARD) {
    return false
  }

  // Must have valid certificate
  if (!ctx.hasCertificate || !ctx.isCertificateValid) {
    return false
  }

  return true
}
```

---

## 3. Create Tax Domain

### 3.1 Migrate VAT Calculation to Domain

The existing `fiscal-rules/service.ts` has float violations. Create clean domain version:

**`src/domain/tax/VatBreakdown.ts`:**

```typescript
// src/domain/tax/VatBreakdown.ts
import { Money } from "@/domain/shared"
import { VatRate } from "@/domain/shared"

export interface VatBreakdownLine {
  vatRate: VatRate
  baseAmount: Money
  vatAmount: Money
}

export class VatBreakdown {
  private lines: VatBreakdownLine[] = []

  addLine(baseAmount: Money, vatRate: VatRate): void {
    const vatAmount = vatRate.calculateVat(baseAmount)
    this.lines.push({ vatRate, baseAmount, vatAmount })
  }

  getLines(): readonly VatBreakdownLine[] {
    return [...this.lines]
  }

  totalBase(): Money {
    return this.lines.reduce((sum, line) => sum.add(line.baseAmount), Money.zero())
  }

  totalVat(): Money {
    return this.lines.reduce((sum, line) => sum.add(line.vatAmount), Money.zero())
  }

  totalGross(): Money {
    return this.totalBase().add(this.totalVat())
  }

  /**
   * Group by VAT rate for reporting
   */
  byRate(): Map<number, { base: Money; vat: Money }> {
    const grouped = new Map<number, { base: Money; vat: Money }>()

    for (const line of this.lines) {
      const rateKey = line.vatRate.rateAsPercentage()
      const existing = grouped.get(rateKey) || {
        base: Money.zero(),
        vat: Money.zero(),
      }
      grouped.set(rateKey, {
        base: existing.base.add(line.baseAmount),
        vat: existing.vat.add(line.vatAmount),
      })
    }

    return grouped
  }
}
```

---

## 4. Create Infrastructure for Fiscalization

### 4.1 Move XML Building to Infrastructure

**`src/infrastructure/fiscal/XmlBuilder.ts`:**

```typescript
// src/infrastructure/fiscal/XmlBuilder.ts
import { Invoice } from "@/domain/invoicing"
import { VatBreakdown } from "@/domain/tax/VatBreakdown"

export interface FiscalXmlInput {
  invoice: Invoice
  vatBreakdown: VatBreakdown
  oib: string
  zki: string
  operatorOib: string
  premiseCode: number
  deviceCode: number
  sequenceMarker: string
}

export function buildFiscalXml(input: FiscalXmlInput): string {
  const now = new Date()

  // Build XML per APIS-IT specification
  return `<?xml version="1.0" encoding="UTF-8"?>
<tns:RacunZahtjev xmlns:tns="http://www.apis-it.hr/fin/2012/types/f73"
                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <tns:Zaglavlje>
    <tns:IdPoruke>${crypto.randomUUID()}</tns:IdPoruke>
    <tns:DatumVrijeme>${formatDateTime(now)}</tns:DatumVrijeme>
  </tns:Zaglavlje>
  <tns:Racun>
    <tns:Oib>${input.oib}</tns:Oib>
    <tns:USustPdv>true</tns:USustPdv>
    <tns:DatVrijeme>${formatDateTime(input.invoice.issueDate!)}</tns:DatVrijeme>
    <tns:OznSlijed>${input.sequenceMarker}</tns:OznSlijed>
    <tns:BrRac>
      <tns:BrOznRac>${input.invoice.invoiceNumber!.sequenceNumber}</tns:BrOznRac>
      <tns:OznPosPr>${input.premiseCode}</tns:OznPosPr>
      <tns:OznNapUr>${input.deviceCode}</tns:OznNapUr>
    </tns:BrRac>
    ${buildVatBreakdownXml(input.vatBreakdown)}
    <tns:IznosUkupno>${formatAmount(input.invoice.grossTotal())}</tns:IznosUkupno>
    <tns:NacinPlac>G</tns:NacinPlac>
    <tns:OibOper>${input.operatorOib}</tns:OibOper>
    <tns:ZastKod>${input.zki}</tns:ZastKod>
    <tns:NakNadoknada>false</tns:NakNadoknada>
  </tns:Racun>
</tns:RacunZahtjev>`
}

function formatDateTime(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 19)
}

function formatAmount(money: Money): string {
  return money.toDecimal().toFixed(2)
}

function buildVatBreakdownXml(breakdown: VatBreakdown): string {
  const byRate = breakdown.byRate()
  let xml = "<tns:Pdv>"

  for (const [rate, { base, vat }] of byRate) {
    xml += `
    <tns:Porez>
      <tns:Stopa>${rate.toFixed(2)}</tns:Stopa>
      <tns:Osnovica>${formatAmount(base)}</tns:Osnovica>
      <tns:Iznos>${formatAmount(vat)}</tns:Iznos>
    </tns:Porez>`
  }

  xml += "</tns:Pdv>"
  return xml
}
```

### 4.2 Create ZKI Signer (Infrastructure)

**`src/infrastructure/fiscal/ZkiSigner.ts`:**

```typescript
// src/infrastructure/fiscal/ZkiSigner.ts
import { createHash, createSign } from "crypto"
import { buildZkiString, ZkiInput } from "@/domain/fiscalization/ZkiCalculator"

export interface Certificate {
  privateKey: string
  publicKey: string
}

/**
 * Signs the ZKI string with the company's private key.
 * Returns the MD5 hash of the signature (per Croatian spec).
 */
export function signZki(input: ZkiInput, certificate: Certificate): string {
  const zkiString = buildZkiString(input)

  // Sign with SHA256 + RSA
  const sign = createSign("SHA256")
  sign.update(zkiString)
  const signature = sign.sign(certificate.privateKey)

  // Return MD5 of signature (Croatian fiscalization requirement)
  const md5 = createHash("md5").update(signature).digest("hex")

  return md5.toUpperCase()
}
```

---

## 5. Golden Tests for Fiscal XML

### 5.1 Create `src/infrastructure/fiscal/__tests__/XmlBuilder.golden.test.ts`

```typescript
import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"
import { buildFiscalXml, FiscalXmlInput } from "../XmlBuilder"
import { Invoice, InvoiceNumber, InvoiceLine } from "@/domain/invoicing"
import { Money, Quantity, VatRate } from "@/domain/shared"
import { VatBreakdown } from "@/domain/tax/VatBreakdown"

describe("Fiscal XML Golden Tests", () => {
  it("generates stable XML for standard invoice", () => {
    const invoice = createTestInvoice()
    const vatBreakdown = new VatBreakdown()
    vatBreakdown.addLine(Money.fromCents(10000), VatRate.HR_STANDARD)

    const input: FiscalXmlInput = {
      invoice,
      vatBreakdown,
      oib: "12345678901",
      zki: "ABC123DEF456",
      operatorOib: "12345678901",
      premiseCode: 1,
      deviceCode: 1,
      sequenceMarker: "P",
    }

    const xml = buildFiscalXml(input)

    const fixturePath = path.join(__dirname, "fixtures/fiscal-standard.xml")

    // On first run, create fixture
    if (!fs.existsSync(fixturePath)) {
      fs.mkdirSync(path.dirname(fixturePath), { recursive: true })
      fs.writeFileSync(fixturePath, xml)
    }

    const expected = fs.readFileSync(fixturePath, "utf8")
    expect(normalizeXml(xml)).toBe(normalizeXml(expected))
  })
})

function normalizeXml(xml: string): string {
  return xml
    .replace(/<tns:IdPoruke>.*<\/tns:IdPoruke>/g, "<tns:IdPoruke>REDACTED</tns:IdPoruke>")
    .replace(
      /<tns:DatumVrijeme>.*<\/tns:DatumVrijeme>/g,
      "<tns:DatumVrijeme>REDACTED</tns:DatumVrijeme>"
    )
    .trim()
}

function createTestInvoice(): Invoice {
  // Create deterministic test invoice
  // ...
}
```

---

## 6. Property-Based Tests for VAT

### 6.1 Create `src/domain/tax/__tests__/VatBreakdown.property.test.ts`

```typescript
import { describe, it, expect } from "vitest"
import fc from "fast-check"
import { VatBreakdown } from "../VatBreakdown"
import { Money, VatRate } from "@/domain/shared"

describe("VatBreakdown property tests", () => {
  it("total gross equals sum of base + VAT", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1000000 }), { minLength: 1, maxLength: 10 }),
        (centAmounts) => {
          const breakdown = new VatBreakdown()

          for (const cents of centAmounts) {
            breakdown.addLine(Money.fromCents(cents), VatRate.HR_STANDARD)
          }

          const totalBase = breakdown.totalBase()
          const totalVat = breakdown.totalVat()
          const totalGross = breakdown.totalGross()

          expect(totalBase.add(totalVat).equals(totalGross)).toBe(true)
        }
      )
    )
  })

  it("VAT is always non-negative", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1000000 }), (cents) => {
        const breakdown = new VatBreakdown()
        breakdown.addLine(Money.fromCents(cents), VatRate.HR_STANDARD)

        expect(breakdown.totalVat().isNegative()).toBe(false)
      })
    )
  })

  it("25% VAT rate produces correct ratio", () => {
    fc.assert(
      fc.property(fc.integer({ min: 100, max: 100000 }), (cents) => {
        const base = Money.fromCents(cents)
        const breakdown = new VatBreakdown()
        breakdown.addLine(base, VatRate.HR_STANDARD)

        const vat = breakdown.totalVat()

        // VAT should be 25% of base (within rounding)
        const expectedVat = base.multiply(0.25).round()
        expect(vat.equals(expectedVat)).toBe(true)
      })
    )
  })
})
```

---

## 7. Idempotency for Fiscal Requests

### 7.1 Create Application Use Case with Idempotency

**`src/application/fiscalization/SubmitFiscalRequest.ts`:**

```typescript
// src/application/fiscalization/SubmitFiscalRequest.ts
import { FiscalRequest } from "@/domain/fiscalization/FiscalRequest"
import { FiscalRequestRepository } from "@/domain/fiscalization/FiscalRequestRepository"

export interface SubmitFiscalRequestInput {
  invoiceId: string
  commandId: string // Idempotency key - client provides this
  zki: string
}

export class SubmitFiscalRequest {
  constructor(
    private readonly repo: FiscalRequestRepository,
    private readonly fiscalService: FiscalService
  ) {}

  async execute(input: SubmitFiscalRequestInput): Promise<FiscalRequest> {
    // Check for existing request with same commandId (idempotency)
    const existing = await this.repo.findByCommandId(input.commandId)
    if (existing) {
      // Return existing result - idempotent
      return existing
    }

    // Create new request
    const request = FiscalRequest.create(input.invoiceId, input.commandId, input.zki)

    await this.repo.save(request)

    // Submit to fiscal service
    try {
      request.markSubmitting()
      const jir = await this.fiscalService.submit(request)
      request.recordSuccess(jir)
    } catch (error) {
      request.recordFailure("SUBMIT_ERROR", error.message)
    }

    await this.repo.save(request)

    return request
  }
}
```

---

## 8. Exit Criteria

Phase 3 is complete when:

- [ ] `src/domain/fiscalization/FiscalRequest.ts` - State machine for fiscal requests
- [ ] `src/domain/fiscalization/ZkiCalculator.ts` - Pure ZKI string builder
- [ ] `src/domain/fiscalization/ShouldFiscalize.ts` - Pure decision logic
- [ ] `src/domain/tax/VatBreakdown.ts` - VAT calculations using Money
- [ ] `src/infrastructure/fiscal/XmlBuilder.ts` - XML generation (no business logic)
- [ ] `src/infrastructure/fiscal/ZkiSigner.ts` - Crypto operations
- [ ] Golden tests for fiscal XML pass
- [ ] Property tests for VAT invariants pass
- [ ] Idempotency enforced via commandId
- [ ] No float operations in domain/tax/

---

**Next Document:** Phase 4 Implementation Plan (Banking & Reconciliation)
