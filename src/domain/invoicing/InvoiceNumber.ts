// src/domain/invoicing/InvoiceNumber.ts
import { InvoiceError } from "./InvoiceError"

export class InvoiceNumber {
  private constructor(
    public readonly sequenceNumber: number,
    public readonly premiseCode: number,
    public readonly deviceCode: number,
    public readonly year: number
  ) {}

  static create(
    sequenceNumber: number,
    premiseCode: number,
    deviceCode: number,
    year: number
  ): InvoiceNumber {
    if (sequenceNumber <= 0) {
      throw new InvoiceError("Sequence number must be positive")
    }
    if (premiseCode <= 0) {
      throw new InvoiceError("Premise code must be positive")
    }
    if (deviceCode <= 0) {
      throw new InvoiceError("Device code must be positive")
    }
    return new InvoiceNumber(sequenceNumber, premiseCode, deviceCode, year)
  }

  static parse(value: string): InvoiceNumber {
    const regex = /^(\d+)-(\d+)-(\d+)$/
    const match = value.match(regex)
    if (!match) {
      throw new InvoiceError(`Invalid invoice number format: ${value}`)
    }
    const [, seq, premise, device] = match
    return new InvoiceNumber(
      parseInt(seq, 10),
      parseInt(premise, 10),
      parseInt(device, 10),
      new Date().getFullYear()
    )
  }

  format(): string {
    return `${this.sequenceNumber}-${this.premiseCode}-${this.deviceCode}`
  }

  formatWithYear(): string {
    return `${this.format()}/${this.year}`
  }
}
