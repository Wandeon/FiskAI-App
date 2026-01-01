// src/domain/compliance/ComplianceError.ts
export class ComplianceError extends Error {
  readonly code = "COMPLIANCE_ERROR"

  constructor(message: string) {
    super(message)
    this.name = "ComplianceError"
  }
}
