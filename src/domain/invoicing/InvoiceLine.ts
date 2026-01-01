// src/domain/invoicing/InvoiceLine.ts
import { Money, Quantity, VatRate } from "@/domain/shared"
import { InvoiceError } from "./InvoiceError"

export class InvoiceLine {
  private constructor(
    public readonly id: string,
    public readonly description: string,
    public readonly quantity: Quantity,
    public readonly unitPrice: Money,
    public readonly vatRate: VatRate,
    public readonly discount: Money = Money.zero()
  ) {}

  static create(params: {
    id?: string
    description: string
    quantity: Quantity
    unitPrice: Money
    vatRate: VatRate
    discount?: Money
  }): InvoiceLine {
    if (!params.description || params.description.trim() === "") {
      throw new InvoiceError("Line description cannot be empty")
    }
    return new InvoiceLine(
      params.id || crypto.randomUUID(),
      params.description.trim(),
      params.quantity,
      params.unitPrice,
      params.vatRate,
      params.discount || Money.zero()
    )
  }

  netTotal(): Money {
    const gross = this.unitPrice.multiply(this.quantity.toDecimal())
    return gross.subtract(this.discount).round()
  }

  vatAmount(): Money {
    return this.vatRate.calculateVat(this.netTotal())
  }

  grossTotal(): Money {
    return this.netTotal().add(this.vatAmount())
  }
}
