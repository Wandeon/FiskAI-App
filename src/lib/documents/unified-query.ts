import { db } from "@/lib/db"
import { EInvoiceStatus, JobStatus } from "@prisma/client"

// Document categories
export type DocumentCategory = "invoice" | "e-invoice" | "bank-statement" | "expense"

// Unified document type for display
export interface UnifiedDocument {
  id: string
  category: DocumentCategory
  date: Date
  number: string
  counterparty: string | null
  amount: number | string // number for currency amounts, string for "X transakcija"
  currency: string | null
  status: string
  statusColor: "gray" | "blue" | "green" | "amber" | "red"
  detailUrl: string
}

// Category metadata
export const CATEGORY_META: Record<DocumentCategory, { label: string; color: string }> = {
  invoice: { label: "Račun", color: "bg-blue-100 text-blue-800" },
  "e-invoice": { label: "E-Račun", color: "bg-purple-100 text-purple-800" },
  "bank-statement": { label: "Izvod", color: "bg-emerald-100 text-emerald-800" },
  expense: { label: "Trošak", color: "bg-orange-100 text-orange-800" },
}

// Status color mapping
function getInvoiceStatusColor(status: EInvoiceStatus): UnifiedDocument["statusColor"] {
  switch (status) {
    case "DRAFT":
      return "gray"
    case "SENT":
    case "PENDING_FISCALIZATION":
      return "blue"
    case "FISCALIZED":
    case "DELIVERED":
    case "ACCEPTED":
      return "green"
    case "REJECTED":
    case "ERROR":
      return "red"
    case "ARCHIVED":
      return "gray"
    default:
      return "gray"
  }
}

function getBankStatementStatusColor(status: JobStatus): UnifiedDocument["statusColor"] {
  switch (status) {
    case "PENDING":
    case "PROCESSING":
      return "blue"
    case "VERIFIED":
      return "green"
    case "NEEDS_REVIEW":
      return "amber"
    case "FAILED":
      return "red"
    default:
      return "gray"
  }
}

// Status labels (Croatian)
const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Nacrt",
  SENT: "Poslano",
  PENDING_FISCALIZATION: "Čeka fiskalizaciju",
  FISCALIZED: "Fiskalizirano",
  DELIVERED: "Dostavljeno",
  ACCEPTED: "Prihvaćeno",
  REJECTED: "Odbijeno",
  ARCHIVED: "Arhivirano",
  ERROR: "Greška",
}

const BANK_STATUS_LABELS: Record<string, string> = {
  PENDING: "Na čekanju",
  PROCESSING: "Obrada",
  VERIFIED: "Verificirano",
  NEEDS_REVIEW: "Treba pregled",
  FAILED: "Neuspjelo",
}

const EXPENSE_STATUS_LABELS: Record<string, string> = {
  PENDING: "Na čekanju",
  APPROVED: "Odobreno",
  REJECTED: "Odbijeno",
  PAID: "Plaćeno",
}

// Query options
export interface UnifiedQueryOptions {
  companyId: string
  category?: DocumentCategory
  search?: string
  page?: number
  pageSize?: number
}

// Query result
export interface UnifiedQueryResult {
  documents: UnifiedDocument[]
  total: number
  counts: {
    all: number
    invoice: number
    eInvoice: number
    bankStatement: number
    expense: number
  }
}

export async function queryUnifiedDocuments(
  options: UnifiedQueryOptions
): Promise<UnifiedQueryResult> {
  const { companyId, category, search, page = 1, pageSize = 20 } = options

  // Fetch all document types in parallel
  const [invoices, bankStatements, expenses, invoiceCount, bankCount, expenseCount] =
    await Promise.all([
      // Invoices (including e-invoices)
      db.eInvoice.findMany({
        where: {
          companyId,
          ...(search
            ? {
                OR: [
                  { invoiceNumber: { contains: search, mode: "insensitive" } },
                  { buyer: { is: { name: { contains: search, mode: "insensitive" } } } },
                ],
              }
            : {}),
        },
        include: { buyer: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      // Bank statements
      db.importJob.findMany({
        where: {
          companyId,
          ...(search
            ? {
                originalName: { contains: search, mode: "insensitive" },
              }
            : {}),
        },
        include: { bankAccount: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      // Expenses
      db.expense.findMany({
        where: {
          companyId,
          ...(search
            ? {
                OR: [
                  { vendor: { name: { contains: search, mode: "insensitive" } } },
                  { description: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        include: { vendor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
      // Counts
      db.eInvoice.count({ where: { companyId } }),
      db.importJob.count({ where: { companyId } }),
      db.expense.count({ where: { companyId } }),
    ])

  // Normalize invoices
  const normalizedInvoices: UnifiedDocument[] = invoices.map((inv) => ({
    id: inv.id,
    category: inv.type === "E_INVOICE" ? "e-invoice" : "invoice",
    date: inv.issueDate,
    number: inv.invoiceNumber || "Bez broja",
    counterparty: inv.buyer?.name || null,
    amount: Number(inv.totalAmount),
    currency: inv.currency,
    status: INVOICE_STATUS_LABELS[inv.status] || inv.status,
    statusColor: getInvoiceStatusColor(inv.status),
    detailUrl: inv.type === "E_INVOICE" ? `/e-invoices/${inv.id}` : `/invoices/${inv.id}`,
  }))

  // Normalize bank statements
  const normalizedBankStatements: UnifiedDocument[] = bankStatements.map((job) => ({
    id: job.id,
    category: "bank-statement",
    date: job.createdAt,
    number: job.originalName,
    counterparty: job.bankAccount?.name || null,
    amount: `${job.pagesProcessed || 0} str.`,
    currency: null,
    status: BANK_STATUS_LABELS[job.status] || job.status,
    statusColor: getBankStatementStatusColor(job.status),
    detailUrl: `/banking/documents/${job.id}`,
  }))

  // Normalize expenses
  const normalizedExpenses: UnifiedDocument[] = expenses.map((exp) => ({
    id: exp.id,
    category: "expense",
    date: exp.date,
    number: exp.description?.slice(0, 30) || "Bez broja",
    counterparty: exp.vendor?.name || null,
    amount: Number(exp.totalAmount),
    currency: exp.currency,
    status: EXPENSE_STATUS_LABELS[exp.status] || exp.status,
    statusColor: exp.status === "PAID" ? "green" : exp.status === "CANCELLED" ? "red" : "gray",
    detailUrl: `/expenses/${exp.id}`,
  }))

  // Combine and filter by category
  let allDocuments = [...normalizedInvoices, ...normalizedBankStatements, ...normalizedExpenses]

  if (category) {
    allDocuments = allDocuments.filter((doc) => {
      if (category === "invoice") return doc.category === "invoice"
      if (category === "e-invoice") return doc.category === "e-invoice"
      if (category === "bank-statement") return doc.category === "bank-statement"
      if (category === "expense") return doc.category === "expense"
      return true
    })
  }

  // Sort by date descending
  allDocuments.sort((a, b) => b.date.getTime() - a.date.getTime())

  // Calculate counts
  const eInvoiceCount = invoices.filter((i) => i.type === "E_INVOICE").length
  const regularInvoiceCount = invoiceCount - eInvoiceCount

  // Paginate
  const total = allDocuments.length
  const start = (page - 1) * pageSize
  const documents = allDocuments.slice(start, start + pageSize)

  return {
    documents,
    total,
    counts: {
      all: invoiceCount + bankCount + expenseCount,
      invoice: regularInvoiceCount,
      eInvoice: eInvoiceCount,
      bankStatement: bankCount,
      expense: expenseCount,
    },
  }
}
