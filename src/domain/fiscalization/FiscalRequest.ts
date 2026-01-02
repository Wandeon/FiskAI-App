import { FiscalStatus, canTransitionFiscal } from "./FiscalStatus"
import { FiscalError } from "./FiscalError"

/**
 * Default fiscal deadline in hours (Croatian regulation: 48 hours)
 */
export const DEFAULT_FISCAL_DEADLINE_HOURS = 48

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
  /**
   * Custom deadline in hours. If not set, uses DEFAULT_FISCAL_DEADLINE_HOURS (48h).
   * This is useful for testing or different regulatory jurisdictions.
   */
  deadlineHours?: number
}

export class FiscalRequest {
  private props: FiscalRequestProps

  private constructor(props: FiscalRequestProps) {
    this.props = props
  }

  /**
   * Create a new FiscalRequest
   * @param invoiceId - The invoice ID
   * @param commandId - The command ID (idempotency key)
   * @param zki - The ZKI (Zastitni Kod Izdavatelja)
   * @param options - Optional configuration
   * @param options.deadlineHours - Custom deadline in hours (default: 48h per Croatian regulation)
   */
  static create(
    invoiceId: string,
    commandId: string,
    zki: string,
    options?: { deadlineHours?: number }
  ): FiscalRequest {
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
      deadlineHours: options?.deadlineHours,
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
  get deadlineHours(): number {
    return this.props.deadlineHours ?? DEFAULT_FISCAL_DEADLINE_HOURS
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

  /**
   * Check if the fiscal deadline has been exceeded.
   * @param nowOverride - Optional date to use instead of current time (useful for testing)
   */
  isDeadlineExceeded(nowOverride?: Date): boolean {
    const deadline = new Date(this.props.createdAt)
    deadline.setHours(deadline.getHours() + this.deadlineHours)
    const now = nowOverride ?? new Date()
    return now > deadline
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
