import { FiscalStatus, canTransitionFiscal } from "./FiscalStatus"
import { FiscalError } from "./FiscalError"

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
    if (!invoiceId || invoiceId.trim() === "") {
      throw new FiscalError("Invoice ID cannot be empty")
    }
    if (!commandId || commandId.trim() === "") {
      throw new FiscalError("Command ID cannot be empty")
    }
    if (!zki || zki.trim() === "") {
      throw new FiscalError("ZKI cannot be empty")
    }

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
  get createdAt(): Date {
    return this.props.createdAt
  }
  get fiscalizedAt(): Date | undefined {
    return this.props.fiscalizedAt
  }
  get errorCode(): string | undefined {
    return this.props.errorCode
  }
  get errorMessage(): string | undefined {
    return this.props.errorMessage
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

  isDeadlineExceeded(): boolean {
    const deadline = new Date(this.props.createdAt)
    deadline.setHours(deadline.getHours() + 48)
    return new Date() > deadline
  }

  private transitionTo(newStatus: FiscalStatus): void {
    if (!canTransitionFiscal(this.props.status, newStatus)) {
      throw new FiscalError(
        `Invalid fiscal status transition: ${this.props.status} -> ${newStatus}`
      )
    }
    this.props.status = newStatus
  }
}
