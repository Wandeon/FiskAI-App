import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { ResponsiveTable, type Column } from "@/components/ui/responsive-table"
import { Search, FolderOpen, FileText, Receipt, File, Download } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import React from "react"

// Document categories for staff view
type StaffDocumentCategory = "invoice" | "e-invoice" | "bank-statement" | "expense"

// Unified document type for staff cross-client view
interface StaffDocument {
 id: string
 category: StaffDocumentCategory
 date: Date
 number: string
 counterparty: string | null
 amount: number | string
 currency: string | null
 status: string
 statusColor: "gray" | "blue" | "green" | "amber" | "red"
 detailUrl: string
 clientName: string
 clientId: string
}

// Category metadata
const CATEGORY_META: Record<StaffDocumentCategory, { label: string; color: string; icon: typeof FileText }> = {
 invoice: { label: "Invoice", color: "bg-blue-100 text-blue-800", icon: FileText },
 "e-invoice": { label: "E-Invoice", color: "bg-purple-100 text-purple-800", icon: FileText },
 "bank-statement": { label: "Bank Statement", color: "bg-emerald-100 text-emerald-800", icon: File },
 expense: { label: "Expense", color: "bg-orange-100 text-orange-800", icon: Receipt },
}

const STATUS_COLORS: Record<string, string> = {
 gray: "bg-gray-100 text-secondary",
 blue: "bg-blue-100 text-info-text",
 green: "bg-green-100 text-success-text",
 amber: "bg-amber-100 text-warning-text",
 red: "bg-red-100 text-danger-text",
}

// Status labels
const INVOICE_STATUS_LABELS: Record<string, string> = {
 DRAFT: "Draft",
 SENT: "Sent",
 PENDING_FISCALIZATION: "Pending Fiscalization",
 FISCALIZED: "Fiscalized",
 DELIVERED: "Delivered",
 ACCEPTED: "Accepted",
 REJECTED: "Rejected",
 ARCHIVED: "Archived",
 ERROR: "Error",
}

const BANK_STATUS_LABELS: Record<string, string> = {
 PENDING: "Pending",
 PROCESSING: "Processing",
 VERIFIED: "Verified",
 NEEDS_REVIEW: "Needs Review",
 FAILED: "Failed",
}

const EXPENSE_STATUS_LABELS: Record<string, string> = {
 PENDING: "Pending",
 APPROVED: "Approved",
 REJECTED: "Rejected",
 PAID: "Paid",
 CANCELLED: "Cancelled",
}

function getInvoiceStatusColor(status: string): StaffDocument["statusColor"] {
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

function getBankStatementStatusColor(status: string): StaffDocument["statusColor"] {
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

function formatCurrency(value: number, currency: string) {
 return new Intl.NumberFormat("en-US", {
 style: "currency",
 currency,
 }).format(value)
}

function formatDate(date: Date) {
 return new Date(date).toLocaleDateString("en-US", {
 day: "2-digit",
 month: "short",
 year: "numeric",
 })
}

interface PageProps {
 searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function getStaffDocuments(
 staffUserId: string,
 options: {
 category?: StaffDocumentCategory
 search?: string
 clientId?: string
 page?: number
 pageSize?: number
 }
) {
 const { category, search, clientId, page = 1, pageSize = 20 } = options

 // Get assigned company IDs
 const assignments = await db.staffAssignment.findMany({
 where: { staffId: staffUserId },
 select: { companyId: true, company: { select: { name: true } } },
 })

 const companyIds = assignments.map((a) => a.companyId)
 const companyMap = new Map(assignments.map((a) => [a.companyId, a.company.name]))

 if (companyIds.length === 0) {
 return {
 documents: [],
 total: 0,
 counts: { all: 0, invoice: 0, eInvoice: 0, bankStatement: 0, expense: 0 },
 clients: [],
 }
 }

 // Validate clientId filter
 if (clientId && !companyIds.includes(clientId)) {
 return {
 documents: [],
 total: 0,
 counts: { all: 0, invoice: 0, eInvoice: 0, bankStatement: 0, expense: 0 },
 clients: [],
 error: "Client not assigned",
 }
 }

 // Filter by specific client if requested
 const targetCompanyIds = clientId ? [clientId] : companyIds

 // Build search conditions
 const searchConditions = search
 ? {
 OR: [
 { invoiceNumber: { contains: search, mode: "insensitive" as const } },
 { buyer: { is: { name: { contains: search, mode: "insensitive" as const } } } },
 { description: { contains: search, mode: "insensitive" as const } },
 { originalName: { contains: search, mode: "insensitive" as const } },
 ],
 }
 : {}

 // Fetch documents in parallel
 const [invoices, bankStatements, expenses, invoiceCount, bankCount, expenseCount] = await Promise.all([
 // Invoices (including e-invoices)
 db.eInvoice.findMany({
 where: {
 companyId: { in: targetCompanyIds },
 ...searchConditions,
 },
 include: { buyer: { select: { name: true } } },
 orderBy: { createdAt: "desc" },
 take: 200, // Limit initial fetch
 }),
 // Bank statements
 db.importJob.findMany({
 where: {
 companyId: { in: targetCompanyIds },
 ...searchConditions,
 },
 include: { bankAccount: { select: { name: true } } },
 orderBy: { createdAt: "desc" },
 take: 200,
 }),
 // Expenses
 db.expense.findMany({
 where: {
 companyId: { in: targetCompanyIds },
 ...searchConditions,
 },
 include: { vendor: { select: { name: true } } },
 orderBy: { createdAt: "desc" },
 take: 200,
 }),
 // Counts for all assigned companies
 db.eInvoice.count({ where: { companyId: { in: companyIds } } }),
 db.importJob.count({ where: { companyId: { in: companyIds } } }),
 db.expense.count({ where: { companyId: { in: companyIds } } }),
 ])

 // Normalize invoices
 const normalizedInvoices: StaffDocument[] = invoices.map((inv) => ({
 id: inv.id,
 category: inv.type === "E_INVOICE" ? "e-invoice" : "invoice",
 date: inv.issueDate,
 number: inv.invoiceNumber || "No number",
 counterparty: inv.buyer?.name || null,
 amount: Number(inv.totalAmount),
 currency: inv.currency,
 status: INVOICE_STATUS_LABELS[inv.status] || inv.status,
 statusColor: getInvoiceStatusColor(inv.status),
 detailUrl: `/clients/${inv.companyId}/invoices/${inv.id}`,
 clientName: companyMap.get(inv.companyId) || "Unknown",
 clientId: inv.companyId,
 }))

 // Normalize bank statements
 const normalizedBankStatements: StaffDocument[] = bankStatements.map((job) => ({
 id: job.id,
 category: "bank-statement",
 date: job.createdAt,
 number: job.originalName,
 counterparty: job.bankAccount?.name || null,
 amount: `${job.pagesProcessed || 0} pages`,
 currency: null,
 status: BANK_STATUS_LABELS[job.status] || job.status,
 statusColor: getBankStatementStatusColor(job.status),
 detailUrl: `/clients/${job.companyId}/banking/documents/${job.id}`,
 clientName: companyMap.get(job.companyId) || "Unknown",
 clientId: job.companyId,
 }))

 // Normalize expenses
 const normalizedExpenses: StaffDocument[] = expenses.map((exp) => ({
 id: exp.id,
 category: "expense",
 date: exp.date,
 number: exp.description?.slice(0, 50) || "No description",
 counterparty: exp.vendor?.name || null,
 amount: Number(exp.totalAmount),
 currency: exp.currency,
 status: EXPENSE_STATUS_LABELS[exp.status] || exp.status,
 statusColor: exp.status === "PAID" ? "green" : exp.status === "CANCELLED" ? "red" : "gray",
 detailUrl: `/clients/${exp.companyId}/expenses/${exp.id}`,
 clientName: companyMap.get(exp.companyId) || "Unknown",
 clientId: exp.companyId,
 }))

 // Combine all documents
 let allDocuments = [...normalizedInvoices, ...normalizedBankStatements, ...normalizedExpenses]

 // Filter by category
 if (category) {
 allDocuments = allDocuments.filter((doc) => doc.category === category)
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

 // Get unique clients for filter
 const clients = Array.from(companyMap.entries())
 .map(([id, name]) => ({ id, name }))
 .sort((a, b) => a.name.localeCompare(b.name))

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
 clients,
 }
}

export default async function StaffDocumentsPage({ searchParams }: PageProps) {
 const session = await auth()

 if (!session?.user) {
 redirect("/login")
 }

 const params = await searchParams
 const categoryParam = Array.isArray(params.category) ? params.category[0] : params.category
 const searchTerm = Array.isArray(params.search) ? params.search[0] : params.search
 const clientIdParam = Array.isArray(params.client) ? params.client[0] : params.client
 const pageParam = Array.isArray(params.page) ? params.page[0] : params.page
 const page = parseInt(pageParam || "1")

 const category = categoryParam as StaffDocumentCategory | undefined

 const { documents, total, counts, clients, error } = await getStaffDocuments(session.user.id, {
 category,
 search: searchTerm,
 clientId: clientIdParam,
 page,
 pageSize: 20,
 })

 const totalPages = Math.ceil(total / 20)

 const columns: Column<StaffDocument>[] = [
 {
 key: "date",
 label: "Date",
 render: (doc) => <span className="text-sm text-muted-foreground">{formatDate(doc.date)}</span>,
 },
 {
 key: "client",
 label: "Client",
 render: (doc) => (
 <Link href={`/clients/${doc.clientId}`} className="text-sm font-medium text-primary hover:underline">
 {doc.clientName}
 </Link>
 ),
 },
 {
 key: "category",
 label: "Type",
 render: (doc) => {
 const Icon = CATEGORY_META[doc.category].icon
 return (
 <div className="flex items-center gap-2">
 <Icon className="h-4 w-4" />
 <span className={cn("px-2 py-1 rounded-full text-xs font-medium", CATEGORY_META[doc.category].color)}>
 {CATEGORY_META[doc.category].label}
 </span>
 </div>
 )
 },
 },
 {
 key: "number",
 label: "Number/Description",
 render: (doc) => (
 <Link href={doc.detailUrl} className="font-medium text-primary hover:underline">
 {doc.number.length > 40 ? doc.number.slice(0, 37) + "..." : doc.number}
 </Link>
 ),
 },
 {
 key: "counterparty",
 label: "Counterparty",
 render: (doc) => <span className="text-sm">{doc.counterparty || "—"}</span>,
 },
 {
 key: "amount",
 label: "Amount",
 render: (doc) => (
 <span className="text-sm font-medium">
 {typeof doc.amount === "number" && doc.currency ? formatCurrency(doc.amount, doc.currency) : doc.amount}
 </span>
 ),
 },
 {
 key: "status",
 label: "Status",
 render: (doc) => (
 <span className={cn("px-2 py-1 rounded-full text-xs font-medium", STATUS_COLORS[doc.statusColor])}>
 {doc.status}
 </span>
 ),
 },
 {
 key: "actions",
 label: "",
 render: (doc) => (
 <Link href={doc.detailUrl} className="text-sm text-primary hover:underline">
 View
 </Link>
 ),
 },
 ]

 function buildFilterLink(params: { category?: string; client?: string; search?: string; page?: number }) {
 const urlParams = new URLSearchParams()
 if (params.category) urlParams.set("category", params.category)
 if (params.client) urlParams.set("client", params.client)
 if (params.search) urlParams.set("search", params.search)
 if (params.page) urlParams.set("page", String(params.page))
 return `/documents?${urlParams.toString()}`
 }

 return (
 <div className="space-y-6">
 {/* Header */}
 <div>
 <h1 className="text-2xl font-bold">Documents</h1>
 <p className="text-muted-foreground">Cross-client document access and search</p>
 </div>

 {/* Stats Cards */}
 <div className="grid gap-4 md:grid-cols-5">
 <Link
 href={buildFilterLink({})}
 className={cn(
 "block transition-colors",
 !category && "ring-2 ring-primary"
 )}
 >
 <Card className="hover:bg-accent/50">
 <CardContent className="pt-6">
 <p className="text-sm text-muted-foreground">All Documents</p>
 <p className="text-2xl font-bold">{counts.all}</p>
 </CardContent>
 </Card>
 </Link>
 <Link
 href={buildFilterLink({ category: "invoice" })}
 className={cn(
 "block transition-colors",
 category === "invoice" && "ring-2 ring-primary"
 )}
 >
 <Card className="hover:bg-accent/50">
 <CardContent className="pt-6">
 <p className="text-sm text-muted-foreground">Invoices</p>
 <p className="text-2xl font-bold">{counts.invoice}</p>
 </CardContent>
 </Card>
 </Link>
 <Link
 href={buildFilterLink({ category: "e-invoice" })}
 className={cn(
 "block transition-colors",
 category === "e-invoice" && "ring-2 ring-primary"
 )}
 >
 <Card className="hover:bg-accent/50">
 <CardContent className="pt-6">
 <p className="text-sm text-muted-foreground">E-Invoices</p>
 <p className="text-2xl font-bold">{counts.eInvoice}</p>
 </CardContent>
 </Card>
 </Link>
 <Link
 href={buildFilterLink({ category: "bank-statement" })}
 className={cn(
 "block transition-colors",
 category === "bank-statement" && "ring-2 ring-primary"
 )}
 >
 <Card className="hover:bg-accent/50">
 <CardContent className="pt-6">
 <p className="text-sm text-muted-foreground">Bank Statements</p>
 <p className="text-2xl font-bold">{counts.bankStatement}</p>
 </CardContent>
 </Card>
 </Link>
 <Link
 href={buildFilterLink({ category: "expense" })}
 className={cn(
 "block transition-colors",
 category === "expense" && "ring-2 ring-primary"
 )}
 >
 <Card className="hover:bg-accent/50">
 <CardContent className="pt-6">
 <p className="text-sm text-muted-foreground">Expenses</p>
 <p className="text-2xl font-bold">{counts.expense}</p>
 </CardContent>
 </Card>
 </Link>
 </div>

 {/* Filters */}
 <Card>
 <CardContent className="pt-6 space-y-4">
 <div className="grid gap-4 md:grid-cols-2">
 {/* Client Filter */}
 <div>
 <label className="text-sm font-medium mb-2 block">Filter by Client</label>
 <select
 className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
 value={clientIdParam || ""}
 onChange={(e) => {
 window.location.href = buildFilterLink({
 category: categoryParam,
 search: searchTerm,
 client: e.target.value || undefined,
 })
 }}
 >
 <option value="">All Clients ({clients.length})</option>
 {clients.map((client) => (
 <option key={client.id} value={client.id}>
 {client.name}
 </option>
 ))}
 </select>
 </div>

 {/* Search */}
 <form method="GET" action="/documents" className="space-y-2">
 <label className="text-sm font-medium block">Search Documents</label>
 {category && <input type="hidden" name="category" value={category} />}
 {clientIdParam && <input type="hidden" name="client" value={clientIdParam} />}
 <div className="flex gap-2">
 <input
 type="text"
 name="search"
 defaultValue={searchTerm}
 placeholder="Search by number, name, description..."
 className="flex-1 rounded-lg border border-input bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
 />
 <button
 type="submit"
 className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
 >
 <Search className="h-4 w-4" />
 </button>
 </div>
 </form>
 </div>

 {/* Active Filters */}
 {(category || clientIdParam || searchTerm) && (
 <div className="flex items-center gap-2">
 <span className="text-sm text-muted-foreground">Active filters:</span>
 {category && (
 <Badge variant="secondary">
 Type: {CATEGORY_META[category].label}
 <Link href={buildFilterLink({ client: clientIdParam, search: searchTerm })} className="ml-2">
 ×
 </Link>
 </Badge>
 )}
 {clientIdParam && (
 <Badge variant="secondary">
 Client: {clients.find((c) => c.id === clientIdParam)?.name || clientIdParam}
 <Link href={buildFilterLink({ category: categoryParam, search: searchTerm })} className="ml-2">
 ×
 </Link>
 </Badge>
 )}
 {searchTerm && (
 <Badge variant="secondary">
 Search: "{searchTerm}"
 <Link href={buildFilterLink({ category: categoryParam, client: clientIdParam })} className="ml-2">
 ×
 </Link>
 </Badge>
 )}
 <Link href="/documents" className="text-sm text-primary hover:underline">
 Clear all
 </Link>
 </div>
 )}
 </CardContent>
 </Card>

 {/* Documents Table */}
 <Card>
 <CardContent className="p-0">
 {documents.length === 0 ? (
 <div className="py-12">
 <EmptyState
 icon={searchTerm ? <Search className="h-8 w-8" /> : <FolderOpen className="h-8 w-8" />}
 title={error ? "Access Denied" : searchTerm ? "No results found" : "No documents"}
 description={
 error
 ? "The selected client is not assigned to you. Please select a client from your assigned list."
 : searchTerm
 ? `No documents match "${searchTerm}". Try a different search term or remove filters.`
 : "No documents found for your assigned clients."
 }
 />
 </div>
 ) : (
 <ResponsiveTable
 columns={columns}
 data={documents}
 getRowKey={(doc) => `${doc.category}-${doc.id}`}
 renderCard={(doc) => (
 <div className="rounded-lg border border-border bg-card p-4 shadow-sm space-y-3">
 <div className="flex items-start justify-between gap-3">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-1">
 {React.createElement(CATEGORY_META[doc.category].icon, { className: "h-4 w-4" })}
 <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", CATEGORY_META[doc.category].color)}>
 {CATEGORY_META[doc.category].label}
 </span>
 </div>
 <p className="text-xs uppercase text-muted-foreground tracking-wide">{formatDate(doc.date)}</p>
 <p className="font-semibold">
 {doc.number.length > 30 ? doc.number.slice(0, 27) + "..." : doc.number}
 </p>
 <p className="text-sm text-muted-foreground">{doc.counterparty || "—"}</p>
 <Link href={`/clients/${doc.clientId}`} className="text-sm text-primary hover:underline">
 {doc.clientName}
 </Link>
 </div>
 <div className="text-right">
 <p className="text-lg font-semibold">
 {typeof doc.amount === "number" && doc.currency
 ? formatCurrency(doc.amount, doc.currency)
 : doc.amount}
 </p>
 </div>
 </div>
 <div className="flex items-center justify-between">
 <span className={cn("px-2 py-1 rounded-full text-xs font-medium", STATUS_COLORS[doc.statusColor])}>
 {doc.status}
 </span>
 <Link href={doc.detailUrl} className="text-sm font-semibold text-primary hover:underline">
 View Details →
 </Link>
 </div>
 </div>
 )}
 />
 )}
 </CardContent>
 </Card>

 {/* Pagination */}
 {totalPages > 1 && (
 <div className="flex justify-center gap-2">
 {page > 1 && (
 <Link
 href={buildFilterLink({ category: categoryParam, client: clientIdParam, search: searchTerm, page: page - 1 })}
 className="px-3 py-1 border border-border rounded-lg hover:bg-accent"
 >
 ← Previous
 </Link>
 )}
 <span className="px-3 py-1 text-muted-foreground">
 Page {page} of {totalPages}
 </span>
 {page < totalPages && (
 <Link
 href={buildFilterLink({ category: categoryParam, client: clientIdParam, search: searchTerm, page: page + 1 })}
 className="px-3 py-1 border border-border rounded-lg hover:bg-accent"
 >
 Next →
 </Link>
 )}
 </div>
 )}
 </div>
 )
}
