import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { notFound, redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { DataTable, Column } from "@/components/ui/data-table"
import { FileText, Download, Eye } from "lucide-react"
import Link from "next/link"

interface PageProps {
  params: Promise<{ clientId: string }>
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
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING_FISCALIZATION: "bg-yellow-100 text-yellow-700",
  FISCALIZED: "bg-blue-100 text-blue-700",
  SENT: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-green-100 text-green-700",
  ACCEPTED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  ARCHIVED: "bg-gray-100 text-gray-600",
  ERROR: "bg-red-100 text-red-700",
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
}

async function getClientInvoices(companyId: string) {
  return db.eInvoice.findMany({
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
}

export default async function ClientEInvoicesPage({ params }: PageProps) {
  const { clientId } = await params
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const invoices = await getClientInvoices(clientId)

  // Calculate stats
  const stats = {
    total: invoices.length,
    drafts: invoices.filter((i) => i.status === "DRAFT").length,
    sent: invoices.filter((i) => ["SENT", "DELIVERED", "ACCEPTED"].includes(i.status)).length,
    totalAmount: invoices.reduce((sum, i) => sum + Number(i.totalAmount), 0),
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
            statusColors[invoice.status] || "bg-gray-100 text-gray-700"
          }`}
        >
          {statusLabels[invoice.status] || invoice.status}
        </span>
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
      <div className="grid gap-4 md:grid-cols-4">
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
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Amount</p>
            <p className="text-2xl font-bold">{stats.totalAmount.toFixed(2)} EUR</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoice List */}
      <Card>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={<FileText className="h-8 w-8" />}
                title="No invoices yet"
                description="This client has not created any e-invoices yet."
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
