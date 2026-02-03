"use client"

import Link from "next/link"
import { DataTable, Column } from "@/components/ui/data-table"
import { EInvoiceActions } from "./invoice-actions"

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

interface EInvoicesTableProps {
  data: InvoiceItem[]
  hasProvider: boolean
}

export function EInvoicesTable({ data, hasProvider }: EInvoicesTableProps) {
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
        <EInvoiceActions invoiceId={invoice.id} status={invoice.status} hasProvider={hasProvider} />
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={data}
      caption="Popis e-računa"
      emptyMessage="Nemate još nijedan e-račun. Kliknite 'Novi E-Račun' za početak."
    />
  )
}
