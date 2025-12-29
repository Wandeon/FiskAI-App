import Link from "next/link"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { getEInvoices } from "@/app/actions/invoice"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { EInvoiceActions } from "./invoice-actions"
import { DataTable, Column } from "@/components/ui/data-table"
import { deriveCapabilities } from "@/lib/capabilities"
import { redirect } from "next/navigation"
import { FileText } from "lucide-react"
import { VisibleButton } from "@/lib/visibility"

const statusLabels: Record<string, string> = {
  DRAFT: "Nacrt",
  PENDING_FISCALIZATION: "Čeka fiskalizaciju",
  FISCALIZED: "Fiskalizirano",
  SENT: "Poslano",
  DELIVERED: "Dostavljeno",
  ACCEPTED: "Prihvaćeno",
  REJECTED: "Odbijeno",
  ARCHIVED: "Arhivirano",
  ERROR: "Greška",
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-surface-1 text-foreground",
  PENDING_FISCALIZATION: "bg-warning-bg text-warning-text",
  FISCALIZED: "bg-info-bg text-info-text",
  SENT: "bg-info-bg text-info-text",
  DELIVERED: "bg-success-bg text-success-text",
  ACCEPTED: "bg-success-bg text-success-text",
  REJECTED: "bg-danger-bg text-danger-text",
  ARCHIVED: "bg-surface-1 text-secondary",
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
}

export default async function EInvoicesPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const capabilities = deriveCapabilities(company)
  if (capabilities.modules["e-invoicing"]?.enabled === false) {
    redirect("/settings?tab=plan")
  }

  const { items: eInvoices } = await getEInvoices()

  // Calculate summary stats
  const stats = {
    total: eInvoices.length,
    drafts: eInvoices.filter((i) => i.status === "DRAFT").length,
    sent: eInvoices.filter((i) => ["SENT", "DELIVERED", "ACCEPTED"].includes(i.status)).length,
    totalAmount: eInvoices.reduce((sum, i) => sum + Number(i.totalAmount), 0),
  }

  // Define table columns
  const columns: Column<InvoiceItem>[] = [
    {
      key: "invoiceNumber",
      header: "Broj računa",
      cell: (invoice) => (
        <div>
          <Link
            href={`/e-invoices/${invoice.id}`}
            className="font-medium text-link hover:underline"
          >
            {invoice.invoiceNumber}
          </Link>
          {invoice.jir && (
            <p className="text-xs text-tertiary mt-0.5">JIR: {invoice.jir.substring(0, 8)}...</p>
          )}
        </div>
      ),
    },
    {
      key: "buyer",
      header: "Kupac",
      cell: (invoice) => (
        <div>
          <p className="font-medium">{invoice.buyer?.name || "-"}</p>
          {invoice.buyer?.oib && <p className="text-xs text-secondary">OIB: {invoice.buyer.oib}</p>}
        </div>
      ),
    },
    {
      key: "issueDate",
      header: "Datum",
      cell: (invoice) => new Date(invoice.issueDate).toLocaleDateString("hr-HR"),
    },
    {
      key: "dueDate",
      header: "Dospijeće",
      cell: (invoice) =>
        invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("hr-HR") : "-",
    },
    {
      key: "totalAmount",
      header: "Iznos",
      className: "text-right",
      cell: (invoice) => (
        <div>
          <p className="font-mono font-medium">
            {Number(invoice.totalAmount).toFixed(2)} {invoice.currency}
          </p>
          <p className="text-xs text-secondary">PDV: {Number(invoice.vatAmount).toFixed(2)}</p>
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
            statusColors[invoice.status] || "bg-surface-1 text-foreground"
          }`}
        >
          {statusLabels[invoice.status] || invoice.status}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Akcije",
      className: "text-right",
      cell: (invoice) => (
        <EInvoiceActions
          invoiceId={invoice.id}
          status={invoice.status}
          hasProvider={!!company.eInvoiceProvider}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">E-Računi</h1>
        <VisibleButton id="action:create-invoice" asChild>
          <Button asChild>
            <Link href="/e-invoices/new">Novi E-Račun</Link>
          </Button>
        </VisibleButton>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-secondary">Ukupno računa</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-secondary">Nacrti</p>
            <p className="text-2xl font-bold">{stats.drafts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-secondary">Poslano</p>
            <p className="text-2xl font-bold">{stats.sent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-secondary">Ukupni iznos</p>
            <p className="text-2xl font-bold">{stats.totalAmount.toFixed(2)} EUR</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoice List */}
      <Card>
        <CardContent className="p-0">
          {eInvoices.length === 0 ? (
            <div className="py-6">
              <EmptyState
                icon={<FileText className="h-8 w-8" />}
                title="Nemate još nijedan e-račun"
                description="E-računi omogućuju brzu i sigurnu razmjenu dokumenata s kupcima. Kreirajte račun, fiskalizirajte ga i pošaljite u par klikova."
                action={
                  <VisibleButton id="action:create-invoice" asChild>
                    <Button asChild>
                      <Link href="/e-invoices/new">Kreiraj prvi e-račun</Link>
                    </Button>
                  </VisibleButton>
                }
              />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={eInvoices}
              caption="Popis e-računa"
              emptyMessage="Nemate još nijedan e-račun. Kliknite 'Novi E-Račun' za početak."
              getRowKey={(invoice) => invoice.id}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
