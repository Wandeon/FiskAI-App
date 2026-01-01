// src/domain/banking/BankingError.ts
export class BankingError extends Error {
  readonly code = "BANKING_ERROR"

  constructor(message: string) {
    super(message)
    this.name = "BankingError"
  }
}
