import { requireAuth, requireCompany } from '@/lib/auth-utils'
import { db } from '@/lib/db'
import { setTenantContext } from '@/lib/prisma-extensions'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { InvoiceType, EInvoiceStatus, Prisma } from '@prisma/client'
import { InvoiceFilters } from '@/components/invoices/invoice-filters'
import type { MultiSelectOption } from '@/components/ui/multi-select'
import { ResponsiveTable, type Column } from '@/components/ui/responsive-table'

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
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const params = await searchParams

  const typeParam = params.type
  const statusParam = params.status
  const searchTerm = Array.isArray(params.search) ? params.search[0] ?? '' : params.search ?? ''

  const selectedTypes = Array.isArray(typeParam)
    ? typeParam
    : typeParam
      ? [typeParam]
      : []
  const selectedStatuses = Array.isArray(statusParam)
    ? statusParam
    : statusParam
      ? [statusParam]
      : []

  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page
  const page = parseInt(pageParam || '1')
  const pageSize = 20
  const skip = (page - 1) * pageSize

  // Build filter
  const where: Prisma.EInvoiceWhereInput = {
    companyId: company.id,
  }

  const filteredTypes = selectedTypes.filter(isInvoiceType)
  if (filteredTypes.length > 0) {
    where.type = { in: filteredTypes }
  }
  const filteredStatuses = selectedStatuses.filter(isInvoiceStatus)
  if (filteredStatuses.length > 0) {
    where.status = { in: filteredStatuses }
  }
  if (searchTerm) {
    where.OR = [
      {
        invoiceNumber: {
          contains: searchTerm,
          mode: 'insensitive',
        },
      },
      {
        buyer: {
          is: {
            name: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
        },
      },
    ]
  }

  const [invoices, total, typeStats, statusStats] = await Promise.all([
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
    db.eInvoice.groupBy({
      by: ['status'],
      where: { companyId: company.id },
      _count: true,
      _sum: { totalAmount: true },
    }),
  ])

  const totalPages = Math.ceil(total / pageSize)

  const getStatusBucket = (status: EInvoiceStatus) =>
    statusStats.find((bucket) => bucket.status === status)

  const sumForStatus = (status: EInvoiceStatus) =>
    Number(getStatusBucket(status)?._sum.totalAmount || 0)

  const countForStatus = (status: EInvoiceStatus) =>
    Number(getStatusBucket(status)?._count || 0)

  const sentSum = sumForStatus('SENT') + sumForStatus('PENDING_FISCALIZATION')
  const deliveredSum = sumForStatus('DELIVERED') + sumForStatus('ACCEPTED')
  const draftCount = countForStatus('DRAFT')
  const errorCount = countForStatus('ERROR') + countForStatus('REJECTED')

  type InvoiceRow = typeof invoices[0]

  const columns: Column<InvoiceRow>[] = [
    {
      key: 'invoiceNumber',
      label: 'Broj',
      render: (inv) => (
        <Link href={`/invoices/${inv.id}`} className="font-mono text-brand-600 hover:text-brand-700">
          {inv.invoiceNumber || 'Bez broja'}
        </Link>
      ),
    },
    {
      key: 'type',
      label: 'Vrsta',
      render: (inv) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${TYPE_COLORS[inv.type] || 'bg-gray-100'}`}>
          {TYPE_LABELS[inv.type] || inv.type}
        </span>
      ),
    },
    {
      key: 'buyer',
      label: 'Kupac',
      render: (inv) => inv.buyer?.name || '—',
    },
    {
      key: 'totalAmount',
      label: 'Iznos',
      render: (inv) => formatCurrency(Number(inv.totalAmount), inv.currency),
    },
    {
      key: 'status',
      label: 'Status',
      render: (inv) => (
        <span className="text-sm text-[var(--muted)]">
          {STATUS_LABELS[inv.status] || inv.status}
        </span>
      ),
    },
    {
      key: 'issueDate',
      label: 'Datum',
      render: (inv) => new Date(inv.issueDate).toLocaleDateString('hr-HR'),
    },
    {
      key: 'actions',
      label: '',
      render: (inv) => (
        <Link href={`/invoices/${inv.id}`} className="text-sm text-brand-600 hover:text-brand-700">
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
          const count = typeStats.find((s) => s.type === type)?._count || 0
          const isActive = selectedTypes.includes(type)
          return (
            <Link key={type} href={`/invoices?type=${type}`}>
              <Card className={`cursor-pointer hover:shadow-md transition-shadow ${isActive ? 'ring-2 ring-blue-500' : ''}`}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-sm text-gray-500">{label}</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Status quick buckets */}
      <div className="flex flex-wrap gap-2 text-sm">
        {([
          { status: 'DRAFT' as const, label: 'Nacrti', amount: 0, count: draftCount },
          { status: 'SENT' as const, label: 'Poslano/Fiskalizacija', amount: sentSum, count: countForStatus('SENT') + countForStatus('PENDING_FISCALIZATION') },
          { status: 'DELIVERED' as const, label: 'Dostavljeno/Prihvaćeno', amount: deliveredSum, count: countForStatus('DELIVERED') + countForStatus('ACCEPTED') },
          { status: 'ERROR' as const, label: 'Greške/Odbijeno', amount: 0, count: errorCount },
        ]).map((item) => (
          <Link
            key={item.status}
            href={buildPaginationLink(1, searchTerm, selectedTypes, [item.status])}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-1 font-medium text-[var(--foreground)] hover:border-brand-200 hover:text-brand-700"
          >
            <span className="inline-flex h-2 w-2 rounded-full bg-brand-500" />
            {item.label}
            <span className="text-xs text-[var(--muted)]">
              {item.count} {item.amount > 0 && `· ${formatCurrency(item.amount, 'EUR')}`}
            </span>
          </Link>
        ))}
      </div>

      <InvoiceFilters
        initialSearch={searchTerm}
        initialTypes={selectedTypes}
        initialStatuses={selectedStatuses}
        typeOptions={buildOptions(TYPE_LABELS)}
        statusOptions={buildOptions(STATUS_LABELS)}
      />

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
        <ResponsiveTable
          columns={columns}
          data={invoices}
          className="bg-[var(--surface)] rounded-2xl border border-[var(--border)]"
          getRowKey={(inv) => inv.id}
          renderCard={(inv) => (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase text-[var(--muted)] tracking-wide">
                    {new Date(inv.issueDate).toLocaleDateString('hr-HR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                  <p className="font-semibold text-[var(--foreground)]">{inv.invoiceNumber || 'Bez broja'}</p>
                  <p className="text-sm text-[var(--muted)]">{inv.buyer?.name || 'Nepoznat kupac'}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-[var(--foreground)]">
                    {formatCurrency(Number(inv.totalAmount), inv.currency)}
                  </p>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[inv.type] || 'bg-gray-100'}`}>
                    {TYPE_LABELS[inv.type] || inv.type}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-[var(--muted)]">
                <div>
                  <p className="font-medium text-[var(--foreground)]">
                    {STATUS_LABELS[inv.status] || inv.status}
                  </p>
                  <p className="text-xs uppercase tracking-wide">Status</p>
                </div>
                <Link
                  href={`/invoices/${inv.id}`}
                  className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                >
                  Detalji →
                </Link>
              </div>
            </div>
          )}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Link
              href={buildPaginationLink(page - 1, searchTerm, selectedTypes, selectedStatuses)}
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
              href={buildPaginationLink(page + 1, searchTerm, selectedTypes, selectedStatuses)}
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

function buildOptions(dictionary: Record<string, string>): MultiSelectOption[] {
  return Object.entries(dictionary).map(([value, label]) => ({ value, label }))
}

function buildPaginationLink(
  page: number,
  search: string,
  types: string[],
  statuses: string[],
) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  if (search) {
    params.set('search', search)
  }
  types.forEach((type) => params.append('type', type))
  statuses.forEach((status) => params.append('status', status))
  const query = params.toString()
  return query ? `/invoices?${query}` : '/invoices'
}

function isInvoiceType(value: string): value is InvoiceType {
  return Object.values(InvoiceType).includes(value as InvoiceType)
}

function isInvoiceStatus(value: string): value is EInvoiceStatus {
  return Object.values(EInvoiceStatus).includes(value as EInvoiceStatus)
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('hr-HR', {
    style: 'currency',
    currency,
  }).format(value)
}
