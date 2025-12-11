import Link from "next/link"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { getEInvoices } from "@/app/actions/e-invoice"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { EInvoiceActions } from "./invoice-actions"
import { DataTable, Column } from "@/components/ui/data-table"

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

export default async function EInvoicesPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const { items: eInvoices } = await getEInvoices()

  // Calculate summary stats
  const stats = {
    total: eInvoices.length,
    drafts: eInvoices.filter(i => i.status === "DRAFT").length,
    sent: eInvoices.filter(i => ["SENT", "DELIVERED", "ACCEPTED"].includes(i.status)).length,
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
            className="font-medium text-blue-600 hover:underline"
          >
            {invoice.invoiceNumber}
          </Link>
          {invoice.jir && (
            <p className="text-xs text-gray-400 mt-0.5">
              JIR: {invoice.jir.substring(0, 8)}...
            </p>
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
          {invoice.buyer?.oib && (
            <p className="text-xs text-gray-500">OIB: {invoice.buyer.oib}</p>
          )}
        </div>
      ),
    },
    {
      key: "issueDate",
      header: "Datum",
      cell: (invoice) =>
        new Date(invoice.issueDate).toLocaleDateString("hr-HR"),
    },
    {
      key: "dueDate",
      header: "Dospijeće",
      cell: (invoice) =>
        invoice.dueDate
          ? new Date(invoice.dueDate).toLocaleDateString("hr-HR")
          : "-",
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
          <p className="text-xs text-gray-500">
            PDV: {Number(invoice.vatAmount).toFixed(2)}
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
        <Link href="/e-invoices/new">
          <Button>Novi E-Račun</Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Ukupno računa</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Nacrti</p>
            <p className="text-2xl font-bold">{stats.drafts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Poslano</p>
            <p className="text-2xl font-bold">{stats.sent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Ukupni iznos</p>
            <p className="text-2xl font-bold">{stats.totalAmount.toFixed(2)} EUR</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoice List */}
      <Card>
        <CardContent className="p-0">
          {eInvoices.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-4xl mb-4">📄</div>
              <h3 className="font-semibold text-gray-900 mb-2">Nemate još nijedan e-račun</h3>
              <p className="text-gray-500 mb-4">
                Kreirajte svoj prvi e-račun i pošaljite ga kupcu.
              </p>
              <Link href="/e-invoices/new">
                <Button>Kreiraj prvi e-račun</Button>
              </Link>
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
