// src/domain/banking/BankTransaction.ts
import { Money } from "@/domain/shared"
import { BankingError } from "./BankingError"

export enum TransactionDirection {
  CREDIT = "CREDIT", // Money in
  DEBIT = "DEBIT", // Money out
}

export enum MatchStatus {
  UNMATCHED = "UNMATCHED",
  AUTO_MATCHED = "AUTO_MATCHED",
  MANUAL_MATCHED = "MANUAL_MATCHED",
  IGNORED = "IGNORED",
}

export interface BankTransactionProps {
  id: string
  externalId: string // Bank's transaction ID
  bankAccountId: string
  date: Date
  amount: Money
  direction: TransactionDirection
  balance: Money
  counterpartyName?: string
  counterpartyIban?: string
  reference?: string
  description?: string
  matchStatus: MatchStatus
  matchedInvoiceId?: string
  matchedExpenseId?: string
  version: number
}

export class BankTransaction {
  private props: BankTransactionProps

  private constructor(props: BankTransactionProps) {
    this.props = props
  }

  static create(
    params: Omit<BankTransactionProps, "id" | "matchStatus" | "version">
  ): BankTransaction {
    if (params.amount.isNegative()) {
      throw new BankingError("Amount must be positive; use direction to indicate debit/credit")
    }
    return new BankTransaction({
      ...params,
      id: crypto.randomUUID(),
      matchStatus: MatchStatus.UNMATCHED,
      version: 1,
    })
  }

  static reconstitute(props: BankTransactionProps): BankTransaction {
    return new BankTransaction(props)
  }

  // Getters
  get id(): string {
    return this.props.id
  }

  get externalId(): string {
    return this.props.externalId
  }

  get bankAccountId(): string {
    return this.props.bankAccountId
  }

  get date(): Date {
    return this.props.date
  }

  get amount(): Money {
    return this.props.amount
  }

  get direction(): TransactionDirection {
    return this.props.direction
  }

  get balance(): Money {
    return this.props.balance
  }

  get counterpartyName(): string | undefined {
    return this.props.counterpartyName
  }

  get counterpartyIban(): string | undefined {
    return this.props.counterpartyIban
  }

  get reference(): string | undefined {
    return this.props.reference
  }

  get description(): string | undefined {
    return this.props.description
  }

  get matchStatus(): MatchStatus {
    return this.props.matchStatus
  }

  get matchedInvoiceId(): string | undefined {
    return this.props.matchedInvoiceId
  }

  get matchedExpenseId(): string | undefined {
    return this.props.matchedExpenseId
  }

  get version(): number {
    return this.props.version
  }

  /**
   * Returns the signed amount: positive for credits, negative for debits.
   * This is useful for balance calculations.
   */
  signedAmount(): Money {
    return this.props.direction === TransactionDirection.DEBIT
      ? this.props.amount.multiply(-1)
      : this.props.amount
  }

  /**
   * Check if transaction is matched to an invoice or expense.
   */
  isMatched(): boolean {
    return (
      this.props.matchStatus === MatchStatus.AUTO_MATCHED ||
      this.props.matchStatus === MatchStatus.MANUAL_MATCHED
    )
  }

  // Business methods
  matchToInvoice(invoiceId: string, autoMatched: boolean): void {
    if (!invoiceId?.trim()) {
      throw new BankingError("Invoice ID cannot be empty")
    }
    if (this.props.matchStatus !== MatchStatus.UNMATCHED) {
      throw new BankingError(
        `Cannot match transaction: current status is ${this.props.matchStatus}`
      )
    }
    this.props.matchedInvoiceId = invoiceId
    this.props.matchedExpenseId = undefined
    this.props.matchStatus = autoMatched ? MatchStatus.AUTO_MATCHED : MatchStatus.MANUAL_MATCHED
    this.props.version++
  }

  matchToExpense(expenseId: string, autoMatched: boolean): void {
    if (!expenseId?.trim()) {
      throw new BankingError("Expense ID cannot be empty")
    }
    if (this.props.matchStatus !== MatchStatus.UNMATCHED) {
      throw new BankingError(
        `Cannot match transaction: current status is ${this.props.matchStatus}`
      )
    }
    this.props.matchedExpenseId = expenseId
    this.props.matchedInvoiceId = undefined
    this.props.matchStatus = autoMatched ? MatchStatus.AUTO_MATCHED : MatchStatus.MANUAL_MATCHED
    this.props.version++
  }

  unmatch(): void {
    if (this.props.matchStatus === MatchStatus.UNMATCHED) {
      return // Idempotent - already unmatched
    }
    if (this.props.matchStatus === MatchStatus.IGNORED) {
      throw new BankingError("Cannot unmatch ignored transaction; unignore first")
    }
    this.props.matchedInvoiceId = undefined
    this.props.matchedExpenseId = undefined
    this.props.matchStatus = MatchStatus.UNMATCHED
    this.props.version++
  }

  ignore(): void {
    if (this.props.matchStatus === MatchStatus.IGNORED) {
      return // Idempotent - already ignored
    }
    if (this.isMatched()) {
      throw new BankingError("Cannot ignore matched transaction; unmatch first")
    }
    this.props.matchStatus = MatchStatus.IGNORED
    this.props.version++
  }

  unignore(): void {
    if (this.props.matchStatus !== MatchStatus.IGNORED) {
      return // Idempotent - not ignored
    }
    this.props.matchStatus = MatchStatus.UNMATCHED
    this.props.version++
  }
}
