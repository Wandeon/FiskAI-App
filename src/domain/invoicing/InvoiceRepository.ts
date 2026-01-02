// src/domain/invoicing/InvoiceRepository.ts
import { Invoice } from "./Invoice"
import { InvoiceId } from "./InvoiceId"

/**
 * Invoice repository interface.
 *
 * Note: companyId is no longer passed to methods - it comes from
 * the TenantScopedContext used to construct the repository.
 * All operations are automatically scoped to the tenant.
 */
export interface InvoiceRepository {
  save(invoice: Invoice): Promise<void>
  findById(id: InvoiceId): Promise<Invoice | null>
  findByNumber(number: string): Promise<Invoice | null>
  nextSequenceNumber(premiseCode: number, deviceCode: number): Promise<number>
}
