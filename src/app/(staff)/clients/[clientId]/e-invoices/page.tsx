import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { logStaffAccess, getRequestMetadata } from "@/lib/staff-audit"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { DataTable, Column } from "@/components/ui/data-table"
import { FileText, Download, Eye, Check, Filter } from "lucide-react"
import Link from "next/link"
import { ReviewToggle } from "@/components/staff/review-toggle"
import { StaffReviewEntity } from "@prisma/client"

interface PageProps {
  params: Promise<{ clientId: string }>
  searchParams: Promise<{ filter?: string }>
}

const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_FISCALIZATION: "Pending Fiscalization",
  FISCALIZED: "Fiscalized",
  SENT: "Sent",
  DELIVERED: "Delivered",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  ARCHIVED: "Archived",
  ERROR: "Error",
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-surface-2 text-secondary",
  PENDING_FISCALIZATION: "bg-warning-bg text-warning-text",
  FISCALIZED: "bg-info-bg text-info-text",
  SENT: "bg-info-bg text-info-text",
  DELIVERED: "bg-success-bg text-success-text",
  ACCEPTED: "bg-success-bg text-success-text",
  REJECTED: "bg-danger-bg text-danger-text",
  ARCHIVED: "bg-surface-2 text-secondary",
  ERROR: "bg-danger-bg text-danger-text",
}

type InvoiceItem = {
  id: string
  invoiceNumber: string
  issueDate: Date
  dueDate: Date | null
  totalAmount: number | { toNumber: () => number }
  vatAmount: number | { toNumber: () => number }
  currency: string
  status: string
  jir: string | null
  buyer: {
    name: string
    oib: string | null
  } | null
  isReviewed: boolean
  reviewerName?: string | null
  reviewedAt?: Date | null
}

async function getClientInvoices(companyId: string, filter?: string) {
  // Get all invoices
  const invoices = await db.eInvoice.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      invoiceNumber: true,
      issueDate: true,
      dueDate: true,
      totalAmount: true,
      vatAmount: true,
      currency: true,
      status: true,
      jir: true,
      buyer: {
        select: {
          name: true,
          oib: true,
        },
      },
    },
  })

  // Get all reviews for these invoices
  const invoiceIds = invoices.map((i) => i.id)
  const reviews = await db.staffReview.findMany({
    where: {
      companyId,
      entityType: "EINVOICE",
      entityId: { in: invoiceIds },
    },
    include: {
      reviewer: {
        select: {
          name: true,
        },
      },
    },
  })

  // Create a map for quick lookup
  const reviewMap = new Map(reviews.map((r) => [r.entityId, r]))

  // Merge invoices with review status
  const invoicesWithReview = invoices.map((invoice) => {
    const review = reviewMap.get(invoice.id)
    return {
      ...invoice,
      isReviewed: !!review,
      reviewerName: review?.reviewer.name,
      reviewedAt: review?.reviewedAt,
    }
  })

  // Apply filter
  if (filter === "pending") {
    return invoicesWithReview.filter((i) => !i.isReviewed)
  } else if (filter === "reviewed") {
    return invoicesWithReview.filter((i) => i.isReviewed)
  }

  return invoicesWithReview
}

export default async function ClientEInvoicesPage({ params, searchParams }: PageProps) {
  const { clientId } = await params
  const { filter } = await searchParams
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const invoices = await getClientInvoices(clientId, filter)

  // Log staff access to invoices (GDPR compliance)
  const reqHeaders = await headers()
  const { ipAddress, userAgent } = getRequestMetadata(reqHeaders)
  await logStaffAccess({
    staffUserId: session.user.id,
    clientCompanyId: clientId,
    action: "STAFF_VIEW_INVOICES",
    resourceType: "EInvoice",
    metadata: { invoiceCount: invoices.length },
    ipAddress,
    userAgent,
  })

  // Calculate stats (need all invoices for accurate counts)
  const allInvoices = filter ? await getClientInvoices(clientId) : invoices
  const stats = {
    total: allInvoices.length,
    drafts: allInvoices.filter((i) => i.status === "DRAFT").length,
    sent: allInvoices.filter((i) => ["SENT", "DELIVERED", "ACCEPTED"].includes(i.status)).length,
    totalAmount: allInvoices.reduce((sum, i) => sum + Number(i.totalAmount), 0),
    reviewed: allInvoices.filter((i) => i.isReviewed).length,
    pending: allInvoices.filter((i) => !i.isReviewed).length,
  }

  const columns: Column<InvoiceItem>[] = [
    {
      key: "invoiceNumber",
      header: "Invoice Number",
      cell: (invoice) => (
        <div>
          <span className="font-medium">{invoice.invoiceNumber}</span>
          {invoice.jir && (
            <p className="text-xs text-muted-foreground mt-0.5">
              JIR: {invoice.jir.substring(0, 8)}...
            </p>
          )}
        </div>
      ),
    },
    {
      key: "buyer",
      header: "Buyer",
      cell: (invoice) => (
        <div>
          <p className="font-medium">{invoice.buyer?.name || "-"}</p>
          {invoice.buyer?.oib && (
            <p className="text-xs text-muted-foreground">OIB: {invoice.buyer.oib}</p>
          )}
        </div>
      ),
    },
    {
      key: "issueDate",
      header: "Issue Date",
      cell: (invoice) => new Date(invoice.issueDate).toLocaleDateString("hr-HR"),
    },
    {
      key: "dueDate",
      header: "Due Date",
      cell: (invoice) =>
        invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("hr-HR") : "-",
    },
    {
      key: "totalAmount",
      header: "Amount",
      className: "text-right",
      cell: (invoice) => (
        <div>
          <p className="font-mono font-medium">
            {Number(invoice.totalAmount).toFixed(2)} {invoice.currency}
          </p>
          <p className="text-xs text-muted-foreground">
            VAT: {Number(invoice.vatAmount).toFixed(2)}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      className: "text-center",
      cell: (invoice) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
            statusColors[invoice.status] || "bg-surface-2 text-secondary"
          }`}
        >
          {statusLabels[invoice.status] || invoice.status}
        </span>
      ),
    },
    {
      key: "reviewed",
      header: "Pregled",
      className: "text-center",
      cell: (invoice) => (
        <ReviewToggle
          clientId={clientId}
          entityType="EINVOICE"
          entityId={invoice.id}
          isReviewed={invoice.isReviewed}
          reviewerName={invoice.reviewerName}
          reviewedAt={invoice.reviewedAt}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (invoice) => (
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/clients/${clientId}/e-invoices/${invoice.id}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Invoices</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Drafts</p>
            <p className="text-2xl font-bold">{stats.drafts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Sent</p>
            <p className="text-2xl font-bold">{stats.sent}</p>
          </CardContent>
        </Card>
        <Link href={`/clients/${clientId}/e-invoices?filter=pending`}>
          <Card
            className={`cursor-pointer transition-colors hover:bg-accent/50 ${filter === "pending" ? "border-orange-500 bg-warning-bg" : ""}`}
          >
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Za pregledati</p>
              <p className="text-2xl font-bold text-warning-text">{stats.pending}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href={`/clients/${clientId}/e-invoices?filter=reviewed`}>
          <Card
            className={`cursor-pointer transition-colors hover:bg-accent/50 ${filter === "reviewed" ? "border-success-border bg-success-bg" : ""}`}
          >
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Pregledano</p>
              <p className="text-2xl font-bold text-success-icon">{stats.reviewed}</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Filter indicator */}
      {filter && (
        <div className="flex items-center gap-2">
          <Badge variant={filter === "pending" ? "destructive" : "default"} className="gap-1">
            <Filter className="h-3 w-3" />
            {filter === "pending" ? "Za pregledati" : "Pregledano"}
          </Badge>
          <Link href={`/clients/${clientId}/e-invoices`}>
            <Button variant="ghost" size="sm">
              Ocisti filter
            </Button>
          </Link>
        </div>
      )}

      {/* Invoice List */}
      <Card>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={<FileText className="h-8 w-8" />}
                title={
                  filter === "pending"
                    ? "Sve pregledano!"
                    : filter === "reviewed"
                      ? "Nista nije pregledano"
                      : "No invoices yet"
                }
                description={
                  filter
                    ? "Promijenite filter za prikaz drugih rezultata."
                    : "This client has not created any e-invoices yet."
                }
              />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={invoices}
              caption="Client e-invoices"
              emptyMessage="No invoices found."
              getRowKey={(invoice) => invoice.id}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
