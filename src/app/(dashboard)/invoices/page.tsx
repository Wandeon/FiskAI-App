import { requireAuth, requireCompany } from '@/lib/auth-utils'
import { db } from '@/lib/db'
import { setTenantContext } from '@/lib/prisma-extensions'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { InvoiceType, EInvoiceStatus, Prisma } from '@prisma/client'

const TYPE_LABELS: Record<string, string> = {
  INVOICE: 'Račun',
  E_INVOICE: 'E-Račun',
  QUOTE: 'Ponuda',
  PROFORMA: 'Predračun',
  CREDIT_NOTE: 'Odobrenje',
  DEBIT_NOTE: 'Terećenje',
}

const TYPE_COLORS: Record<string, string> = {
  INVOICE: 'bg-blue-100 text-blue-800',
  E_INVOICE: 'bg-purple-100 text-purple-800',
  QUOTE: 'bg-yellow-100 text-yellow-800',
  PROFORMA: 'bg-orange-100 text-orange-800',
  CREDIT_NOTE: 'bg-green-100 text-green-800',
  DEBIT_NOTE: 'bg-red-100 text-red-800',
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nacrt',
  SENT: 'Poslano',
  PENDING_FISCALIZATION: 'Čeka fiskalizaciju',
  FISCALIZED: 'Fiskalizirano',
  DELIVERED: 'Dostavljeno',
  ACCEPTED: 'Prihvaćeno',
  REJECTED: 'Odbijeno',
  ARCHIVED: 'Arhivirano',
  ERROR: 'Greška',
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; page?: string }>
}) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const params = await searchParams
  const page = parseInt(params.page || '1')
  const pageSize = 20
  const skip = (page - 1) * pageSize

  // Build filter
  const where: Prisma.EInvoiceWhereInput = {
    companyId: company.id,
  }

  if (params.type && params.type in InvoiceType) {
    where.type = params.type as InvoiceType
  }
  if (params.status && params.status in EInvoiceStatus) {
    where.status = params.status as EInvoiceStatus
  }

  const [invoices, total, stats] = await Promise.all([
    db.eInvoice.findMany({
      where,
      include: {
        buyer: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip,
    }),
    db.eInvoice.count({ where }),
    db.eInvoice.groupBy({
      by: ['type'],
      where: { companyId: company.id },
      _count: true,
    }),
  ])

  const totalPages = Math.ceil(total / pageSize)

  type InvoiceRow = typeof invoices[0]

  const columns = [
    {
      key: 'invoiceNumber',
      header: 'Broj',
      cell: (inv: InvoiceRow) => (
        <Link href={`/invoices/${inv.id}`} className="font-mono text-blue-600 hover:underline">
          {inv.invoiceNumber}
        </Link>
      ),
    },
    {
      key: 'type',
      header: 'Vrsta',
      cell: (inv: InvoiceRow) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${TYPE_COLORS[inv.type] || 'bg-gray-100'}`}>
          {TYPE_LABELS[inv.type] || inv.type}
        </span>
      ),
    },
    {
      key: 'buyer',
      header: 'Kupac',
      cell: (inv: InvoiceRow) => inv.buyer?.name || '-',
    },
    {
      key: 'totalAmount',
      header: 'Iznos',
      cell: (inv: InvoiceRow) =>
        new Intl.NumberFormat('hr-HR', {
          style: 'currency',
          currency: inv.currency,
        }).format(Number(inv.totalAmount)),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (inv: InvoiceRow) => (
        <span className="text-sm text-gray-600">
          {STATUS_LABELS[inv.status] || inv.status}
        </span>
      ),
    },
    {
      key: 'issueDate',
      header: 'Datum',
      cell: (inv: InvoiceRow) => new Date(inv.issueDate).toLocaleDateString('hr-HR'),
    },
    {
      key: 'actions',
      header: '',
      cell: (inv: InvoiceRow) => (
        <Link href={`/invoices/${inv.id}`} className="text-sm text-blue-600 hover:underline">
          Pregledaj
        </Link>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dokumenti</h1>
          <p className="text-gray-500">Računi, ponude, predračuni i ostali dokumenti</p>
        </div>
        <div className="flex gap-2">
          <Link href="/invoices/new?type=QUOTE">
            <Button variant="outline">Nova ponuda</Button>
          </Link>
          <Link href="/invoices/new?type=INVOICE">
            <Button variant="outline">Novi račun</Button>
          </Link>
          <Link href="/e-invoices/new">
            <Button>Novi e-račun</Button>
          </Link>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {Object.entries(TYPE_LABELS).map(([type, label]) => {
          const count = stats.find((s) => s.type === type)?._count || 0
          return (
            <Link key={type} href={`/invoices?type=${type}`}>
              <Card className={`cursor-pointer hover:shadow-md transition-shadow ${params.type === type ? 'ring-2 ring-blue-500' : ''}`}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-sm text-gray-500">{label}</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <form className="flex gap-2" method="GET">
          <select
            name="type"
            defaultValue={params.type || ''}
            className="rounded-md border-gray-300 text-sm"
          >
            <option value="">Sve vrste</option>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={params.status || ''}
            className="rounded-md border-gray-300 text-sm"
          >
            <option value="">Svi statusi</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <Button type="submit" variant="outline" size="sm">Filtriraj</Button>
          {(params.type || params.status) && (
            <Link href="/invoices">
              <Button variant="ghost" size="sm">Očisti</Button>
            </Link>
          )}
        </form>
      </div>

      {/* Table */}
      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">Nema dokumenata</p>
            <Link href="/invoices/new?type=INVOICE">
              <Button>Kreiraj prvi dokument</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={invoices}
          caption="Popis dokumenata"
          getRowKey={(inv) => inv.id}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Link
              href={`?page=${page - 1}${params.type ? `&type=${params.type}` : ''}${params.status ? `&status=${params.status}` : ''}`}
              className="px-3 py-1 border rounded hover:bg-gray-50"
            >
              ← Prethodna
            </Link>
          )}
          <span className="px-3 py-1">
            Stranica {page} od {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`?page=${page + 1}${params.type ? `&type=${params.type}` : ''}${params.status ? `&status=${params.status}` : ''}`}
              className="px-3 py-1 border rounded hover:bg-gray-50"
            >
              Sljedeća →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
