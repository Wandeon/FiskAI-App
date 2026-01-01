// src/domain/invoicing/InvoiceRepository.ts
import { Invoice } from "./Invoice"
import { InvoiceId } from "./InvoiceId"

export interface InvoiceRepository {
  save(invoice: Invoice): Promise<void>
  findById(id: InvoiceId): Promise<Invoice | null>
  findByNumber(number: string, companyId: string): Promise<Invoice | null>
  nextSequenceNumber(companyId: string, premiseCode: number, deviceCode: number): Promise<number>
}
