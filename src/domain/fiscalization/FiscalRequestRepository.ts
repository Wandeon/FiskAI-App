import { FiscalRequest } from "./FiscalRequest"

export interface FiscalRequestRepository {
  save(request: FiscalRequest): Promise<void>
  findById(id: string): Promise<FiscalRequest | null>
  findByCommandId(commandId: string): Promise<FiscalRequest | null>
  findByInvoiceId(invoiceId: string): Promise<FiscalRequest[]>
  findPendingRetries(): Promise<FiscalRequest[]>
}
