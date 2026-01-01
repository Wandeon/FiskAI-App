// src/domain/identity/IdentityError.ts
export class IdentityError extends Error {
  readonly code = "IDENTITY_ERROR"

  constructor(message: string) {
    super(message)
    this.name = "IdentityError"
  }
}
