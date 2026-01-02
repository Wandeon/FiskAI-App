// src/domain/invoicing/InvoiceNumber.ts
import { InvoiceError } from "./InvoiceError"

export interface ParseOptions {
  /**
   * The year to use for the invoice number.
   * If not provided, uses the current year.
   */
  year?: number
  /**
   * A date from which to infer the year.
   * If year is also provided, year takes precedence.
   */
  inferFromDate?: Date
}

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

  /**
   * Parse an invoice number string in format "seq-premise-device".
   *
   * @param value - The invoice number string to parse
   * @param options - Optional parsing options for year inference
   * @returns A new InvoiceNumber instance
   *
   * @example
   * // Using explicit year
   * InvoiceNumber.parse("43-1-1", { year: 2023 })
   *
   * @example
   * // Inferring year from a date (e.g., issue date)
   * InvoiceNumber.parse("43-1-1", { inferFromDate: issueDate })
   *
   * @example
   * // Defaults to current year (backward compatible)
   * InvoiceNumber.parse("43-1-1")
   */
  static parse(value: string, options?: ParseOptions): InvoiceNumber {
    const regex = /^(\d+)-(\d+)-(\d+)$/
    const match = value.match(regex)
    if (!match) {
      throw new InvoiceError(`Invalid invoice number format: ${value}`)
    }
    const [, seq, premise, device] = match

    // Determine year: explicit year > inferred from date > current year
    let year: number
    if (options?.year !== undefined) {
      year = options.year
    } else if (options?.inferFromDate !== undefined) {
      year = options.inferFromDate.getFullYear()
    } else {
      year = new Date().getFullYear()
    }

    return new InvoiceNumber(parseInt(seq, 10), parseInt(premise, 10), parseInt(device, 10), year)
  }

  format(): string {
    return `${this.sequenceNumber}-${this.premiseCode}-${this.deviceCode}`
  }

  formatWithYear(): string {
    return `${this.format()}/${this.year}`
  }
}
