// Example: Using ResponsiveTable component
// This demonstrates how to convert a DataTable to ResponsiveTable

import { ResponsiveTable } from '@/components/ui/responsive-table'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'

// Example data type
interface Invoice {
  id: string
  invoiceNumber: string
  type: string
  buyer: { name: string } | null
  totalAmount: number
  currency: string
  status: string
  issueDate: Date
}

// Example component
export function InvoicesTableExample({ invoices }: { invoices: Invoice[] }) {
  const TYPE_LABELS: Record<string, string> = {
    INVOICE: 'Račun',
    E_INVOICE: 'E-Račun',
    QUOTE: 'Ponuda',
    PROFORMA: 'Predračun',
  }

  const TYPE_COLORS: Record<string, string> = {
    INVOICE: 'bg-blue-100 text-blue-800',
    E_INVOICE: 'bg-purple-100 text-purple-800',
    QUOTE: 'bg-yellow-100 text-yellow-800',
    PROFORMA: 'bg-orange-100 text-orange-800',
  }

  const STATUS_LABELS: Record<string, string> = {
    DRAFT: 'Nacrt',
    SENT: 'Poslano',
    FISCALIZED: 'Fiskalizirano',
  }

  // Define columns for desktop table view
  const columns = [
    {
      key: 'invoiceNumber',
      label: 'Broj',
      render: (inv: Invoice) => (
        <Link
          href={`/invoices/${inv.id}`}
          className="font-mono text-blue-600 hover:underline"
        >
          {inv.invoiceNumber}
        </Link>
      ),
    },
    {
      key: 'type',
      label: 'Vrsta',
      render: (inv: Invoice) => (
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            TYPE_COLORS[inv.type] || 'bg-gray-100'
          }`}
        >
          {TYPE_LABELS[inv.type] || inv.type}
        </span>
      ),
    },
    {
      key: 'buyer',
      label: 'Kupac',
      render: (inv: Invoice) => inv.buyer?.name || '-',
    },
    {
      key: 'totalAmount',
      label: 'Iznos',
      render: (inv: Invoice) =>
        new Intl.NumberFormat('hr-HR', {
          style: 'currency',
          currency: inv.currency,
        }).format(inv.totalAmount),
    },
    {
      key: 'status',
      label: 'Status',
      render: (inv: Invoice) => (
        <span className="text-sm text-gray-600">
          {STATUS_LABELS[inv.status] || inv.status}
        </span>
      ),
    },
    {
      key: 'issueDate',
      label: 'Datum',
      render: (inv: Invoice) => new Date(inv.issueDate).toLocaleDateString('hr-HR'),
    },
  ]

  return (
    <ResponsiveTable
      columns={columns}
      data={invoices}
      getRowKey={(inv) => inv.id}
      // Mobile card view
      renderCard={(inv) => (
        <Link href={`/invoices/${inv.id}`}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4">
              {/* Header row with invoice number and type */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-mono text-sm font-medium text-blue-600">
                    {inv.invoiceNumber}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {inv.buyer?.name || '-'}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    TYPE_COLORS[inv.type] || 'bg-gray-100'
                  }`}
                >
                  {TYPE_LABELS[inv.type] || inv.type}
                </span>
              </div>

              {/* Amount and date */}
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-gray-500">Iznos</p>
                  <p className="text-lg font-bold text-gray-900">
                    {new Intl.NumberFormat('hr-HR', {
                      style: 'currency',
                      currency: inv.currency,
                    }).format(inv.totalAmount)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">
                    {STATUS_LABELS[inv.status] || inv.status}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {new Date(inv.issueDate).toLocaleDateString('hr-HR')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}
    />
  )
}

// Usage in a page:
// <InvoicesTableExample invoices={invoices} />
