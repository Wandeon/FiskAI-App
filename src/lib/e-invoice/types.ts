import { EInvoice, EInvoiceLine, Contact, Company } from "@prisma/client"

export interface EInvoiceWithRelations extends EInvoice {
  lines: EInvoiceLine[]
  buyer: Contact | null
  seller: Contact | null
  company: Company
}

export interface SendInvoiceResult {
  success: boolean
  providerRef?: string
  jir?: string
  zki?: string
  error?: string
}

export interface IncomingInvoice {
  providerRef: string
  sellerOib: string
  sellerName: string
  invoiceNumber: string
  issueDate: Date
  totalAmount: number
  currency: string
  ublXml: string
}

/**
 * Filter parameters for fetching incoming invoices
 */
export interface IncomingInvoiceFilter {
  /** Start of date range (inclusive) */
  fromDate?: Date
  /** End of date range (inclusive) */
  toDate?: Date
  /** Page number for pagination (1-indexed) */
  page?: number
  /** Page size for pagination */
  pageSize?: number
}

/**
 * Result of listing incoming invoices
 */
export interface ListIncomingResult {
  invoices: IncomingInvoice[]
  totalCount: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface InvoiceStatusResult {
  status: "pending" | "delivered" | "accepted" | "rejected" | "error"
  message?: string
  updatedAt: Date
}

export interface ArchiveResult {
  success: boolean
  archiveRef?: string
  error?: string
}

export interface ProviderConfig {
  apiKey: string
  apiUrl?: string
  sandbox?: boolean
}
