export class FiscalError extends Error {
  readonly code = "FISCAL_ERROR"
  constructor(message: string) {
    super(message)
    this.name = "FiscalError"
  }
}
