// src/domain/invoicing/InvoiceId.ts
import { InvoiceError } from "./InvoiceError"

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
