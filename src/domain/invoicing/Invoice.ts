// src/domain/invoicing/Invoice.ts
import { Money } from "@/domain/shared"
import { InvoiceId } from "./InvoiceId"
import { InvoiceNumber } from "./InvoiceNumber"
import { InvoiceStatus, canTransition } from "./InvoiceStatus"
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
  jir?: string
  zki?: string
  fiscalizedAt?: Date
  version: number
}

export class Invoice {
  private props: InvoiceProps

  private constructor(props: InvoiceProps) {
    this.props = props
  }

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

  // Getters
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
  get fiscalizedAt(): Date | undefined {
    return this.props.fiscalizedAt
  }
  get version(): number {
    return this.props.version
  }

  getLines(): readonly InvoiceLine[] {
    return [...this.props.lines]
  }

  // Calculations
  netTotal(): Money {
    return this.props.lines.reduce((sum, line) => sum.add(line.netTotal()), Money.zero())
  }

  vatTotal(): Money {
    return this.props.lines.reduce((sum, line) => sum.add(line.vatAmount()), Money.zero())
  }

  grossTotal(): Money {
    return this.netTotal().add(this.vatTotal())
  }

  // Business verbs
  addLine(line: InvoiceLine): void {
    this.assertDraft("add line")
    this.props.lines.push(line)
    this.props.version++
  }

  removeLine(lineId: string): void {
    this.assertDraft("remove line")
    const index = this.props.lines.findIndex((l) => l.id === lineId)
    if (index === -1) throw new InvoiceError(`Line ${lineId} not found`)
    this.props.lines.splice(index, 1)
    this.props.version++
  }

  updateBuyer(buyerId: string): void {
    this.assertDraft("update buyer")
    this.props.buyerId = buyerId
    this.props.version++
  }

  issue(invoiceNumber: InvoiceNumber, issueDate: Date, dueDate: Date): void {
    this.assertDraft("issue")
    if (this.props.lines.length === 0) throw new InvoiceError("Cannot issue invoice with no lines")
    if (dueDate < issueDate) throw new InvoiceError("Due date cannot be before issue date")
    this.props.invoiceNumber = invoiceNumber
    this.props.issueDate = issueDate
    this.props.dueDate = dueDate
    this.transitionTo(InvoiceStatus.PENDING_FISCALIZATION)
  }

  fiscalize(jir: string, zki: string): void {
    this.assertStatus(InvoiceStatus.PENDING_FISCALIZATION, "fiscalize")
    if (!jir?.trim()) throw new InvoiceError("JIR cannot be empty")
    if (!zki?.trim()) throw new InvoiceError("ZKI cannot be empty")
    this.props.jir = jir
    this.props.zki = zki
    this.props.fiscalizedAt = new Date()
    this.transitionTo(InvoiceStatus.FISCALIZED)
  }

  markSent(): void {
    this.assertStatus(InvoiceStatus.FISCALIZED, "mark sent")
    this.transitionTo(InvoiceStatus.SENT)
  }

  markDelivered(): void {
    this.assertStatus(InvoiceStatus.SENT, "mark delivered")
    this.transitionTo(InvoiceStatus.DELIVERED)
  }

  accept(): void {
    if (this.props.status !== InvoiceStatus.SENT && this.props.status !== InvoiceStatus.DELIVERED) {
      throw new InvoiceError(`Cannot accept invoice in ${this.props.status} status`)
    }
    this.transitionTo(InvoiceStatus.ACCEPTED)
  }

  archive(): void {
    this.assertStatus(InvoiceStatus.ACCEPTED, "archive")
    this.transitionTo(InvoiceStatus.ARCHIVED)
  }

  cancel(): void {
    this.assertDraft("cancel")
    this.transitionTo(InvoiceStatus.CANCELED)
  }

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
