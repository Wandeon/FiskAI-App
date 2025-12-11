import { requireAuth, requireCompany } from '@/lib/auth-utils'
import { db } from '@/lib/db'
import { setTenantContext } from '@/lib/prisma-extensions'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ExpenseStatus, Prisma } from '@prisma/client'
import { ExpenseFilters } from '@/components/expenses/expense-filters'
import type { MultiSelectOption } from '@/components/ui/multi-select'
import { ResponsiveTable, type Column } from '@/components/ui/responsive-table'
import { ExpenseInlineStatus } from '@/components/expenses/expense-inline-status'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nacrt',
  PENDING: 'Čeka plaćanje',
  PAID: 'Plaćeno',
  CANCELLED: 'Otkazano',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const params = await searchParams

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const searchTerm = Array.isArray(params.search) ? params.search[0] ?? '' : params.search ?? ''
  const statusParam = params.status
  const categoryParam = params.category

  const selectedStatuses = Array.isArray(statusParam)
    ? statusParam
    : statusParam
      ? [statusParam]
      : []
  const selectedCategories = Array.isArray(categoryParam)
    ? categoryParam
    : categoryParam
      ? [categoryParam]
      : []

  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page
  const page = parseInt(pageParam || '1')
  const pageSize = 20
  const skip = (page - 1) * pageSize

  const where: PrismaExpenseWhere = {
    companyId: company.id,
  }

  const filteredStatuses = selectedStatuses.filter(isExpenseStatus)
  if (filteredStatuses.length > 0) {
    where.status = { in: filteredStatuses }
  }

  if (selectedCategories.length > 0) {
    where.categoryId = { in: selectedCategories }
  }

  if (searchTerm) {
    where.OR = [
      {
        vendor: {
          is: {
            name: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
        },
      },
      {
        description: {
          contains: searchTerm,
          mode: 'insensitive',
        },
      },
      {
        vendor: {
          is: {
            oib: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
        },
      },
    ]
  }

  const [expenses, total, categories, statusBuckets, categoryBuckets] = await Promise.all([
    db.expense.findMany({
      where,
      include: {
        vendor: { select: { name: true } },
        category: { select: { name: true, code: true } },
      },
      orderBy: { date: 'desc' },
      take: pageSize,
      skip,
    }),
    db.expense.count({ where }),
    db.expenseCategory.findMany({
      where: { OR: [{ companyId: company.id }, { companyId: null }] },
      orderBy: { name: 'asc' },
    }),
    db.expense.groupBy({
      by: ['status'],
      where: { companyId: company.id },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
    db.expense.groupBy({
      by: ['categoryId', 'currency'],
      where: { companyId: company.id },
      _sum: { totalAmount: true },
    }),
  ])

  const totalPages = Math.ceil(total / pageSize)

  const getBucket = (status: ExpenseStatus) => statusBuckets.find((bucket) => bucket.status === status)
  const sumFor = (status: ExpenseStatus) => Number(getBucket(status)?._sum.totalAmount || 0)
  const countFor = (status: ExpenseStatus) => Number(getBucket(status)?._count.id || 0)
  const paidSum = sumFor('PAID')
  const pendingSum = sumFor('PENDING')
  const draftCount = countFor('DRAFT')
  const pendingCount = countFor('PENDING')
  const paidCount = countFor('PAID')

  const topCategories = categoryBuckets
    .reduce<Record<string, { label: string; amount: number; currency: string }>>((acc, bucket) => {
      const category = categories.find((c) => c.id === bucket.categoryId)
      const key = `${bucket.categoryId}-${bucket.currency}`
      acc[key] = {
        label: category?.name || 'Nepoznato',
        amount: Number(bucket._sum.totalAmount || 0),
        currency: bucket.currency,
      }
      return acc
    }, {})

  const sortedCategories = Object.values(topCategories).sort((a, b) => b.amount - a.amount).slice(0, 3)

  const columns: Column<typeof expenses[0]>[] = [
    {
      key: 'date',
      label: 'Datum',
      render: (exp) => new Date(exp.date).toLocaleDateString('hr-HR'),
    },
    {
      key: 'description',
      label: 'Opis',
      render: (exp) => (
        exp.description.length > 40 ? `${exp.description.slice(0, 40)}…` : exp.description
      ),
    },
    {
      key: 'vendor',
      label: 'Dobavljač',
      render: (exp) => exp.vendor?.name || '—',
    },
    {
      key: 'category',
      label: 'Kategorija',
      render: (exp) => exp.category.name,
    },
    {
      key: 'totalAmount',
      label: 'Iznos',
      render: (exp) => formatCurrency(Number(exp.totalAmount), exp.currency),
    },
    {
      key: 'status',
      label: 'Status',
      render: (exp) => <ExpenseInlineStatus id={exp.id} status={exp.status} />,
    },
    {
      key: 'actions',
      label: '',
      render: (exp) => (
        <Link href={`/expenses/${exp.id}`} className="text-sm text-brand-600 hover:text-brand-700">
          Pregledaj
        </Link>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Troškovi</h1>
          <p className="text-gray-500">Praćenje poslovnih troškova i rashoda</p>
        </div>
        <div className="flex gap-2">
          <Link href="/expenses/categories">
            <Button variant="outline">Kategorije</Button>
          </Link>
          <Link href="/expenses/new">
            <Button>+ Novi trošak</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{total}</p>
            <p className="text-sm text-gray-500">Ukupno troškova</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">
              {new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(paidSum)}
            </p>
            <p className="text-sm text-gray-500">Plaćeno ({paidCount})</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">
              {new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(pendingSum)}
            </p>
            <p className="text-sm text-gray-500">Čeka plaćanje ({pendingCount})</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold">{draftCount}</p>
            <p className="text-sm text-gray-500">Nacrti</p>
          </CardContent>
        </Card>
      </div>

      {sortedCategories.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">Top kategorije</p>
              <p className="text-sm text-[var(--muted)]">Najveći troškovi po kategoriji</p>
            </div>
            <Link href="/expenses/categories" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
              Uredi kategorije →
            </Link>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {sortedCategories.map((cat) => (
              <div key={`${cat.label}-${cat.currency}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                <p className="text-sm font-semibold text-[var(--foreground)]">{cat.label}</p>
                <p className="text-sm text-[var(--muted)]">{formatCurrency(cat.amount, cat.currency)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick status filters */}
      <div className="flex flex-wrap gap-2 text-sm">
        {([
          { status: 'PENDING' as const, label: 'Čeka plaćanje', count: pendingCount },
          { status: 'PAID' as const, label: 'Plaćeno', count: paidCount },
          { status: 'DRAFT' as const, label: 'Nacrt', count: draftCount },
        ]).map((item) => (
          <Link
            key={item.status}
            href={buildPaginationLink(1, searchTerm, [item.status], selectedCategories)}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-1 font-medium text-[var(--foreground)] hover:border-brand-200 hover:text-brand-700"
          >
            <span className="inline-flex h-2 w-2 rounded-full bg-brand-500" />
            {item.label}
            <span className="text-xs text-[var(--muted)]">({item.count})</span>
          </Link>
        ))}
      </div>

      <ExpenseFilters
        statusOptions={buildStatusOptions(STATUS_LABELS)}
        categoryOptions={buildCategoryOptions(categories)}
        initialStatuses={selectedStatuses}
        initialCategories={selectedCategories}
        initialSearch={searchTerm}
      />

      {/* Table */}
      {expenses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">Nema troškova</p>
            <Link href="/expenses/new"><Button>Dodaj prvi trošak</Button></Link>
          </CardContent>
        </Card>
      ) : (
        <ResponsiveTable
          columns={columns}
          data={expenses}
          className="bg-[var(--surface)] rounded-2xl border border-[var(--border)]"
          getRowKey={(exp) => exp.id}
          renderCard={(exp) => (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase text-[var(--muted)] tracking-wide">
                    {new Date(exp.date).toLocaleDateString('hr-HR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                  <p className="text-base font-semibold text-[var(--foreground)]">{exp.description}</p>
                  <p className="text-sm text-[var(--muted)]">{exp.vendor?.name || 'Nepoznati dobavljač'}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-[var(--foreground)]">
                    {formatCurrency(Number(exp.totalAmount), exp.currency)}
                  </p>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[exp.status]}`}>
                    {STATUS_LABELS[exp.status]}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-[var(--muted)]">
                <div>
                  <p className="font-medium text-[var(--foreground)]">{exp.category.name}</p>
                  <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Kategorija</p>
                </div>
                <div className="flex items-center gap-3">
                  <ExpenseInlineStatus id={exp.id} status={exp.status} />
                  <Link
                    href={`/expenses/${exp.id}`}
                    className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Detalji →
                  </Link>
                </div>
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
              href={buildPaginationLink(page - 1, searchTerm, selectedStatuses, selectedCategories)}
              className="px-3 py-1 border rounded hover:bg-gray-50"
            >
              ← Prethodna
            </Link>
          )}
          <span className="px-3 py-1">Stranica {page} od {totalPages}</span>
          {page < totalPages && (
            <Link
              href={buildPaginationLink(page + 1, searchTerm, selectedStatuses, selectedCategories)}
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

type PrismaExpenseWhere = Prisma.ExpenseWhereInput

function buildStatusOptions(dictionary: Record<string, string>): MultiSelectOption[] {
  return Object.entries(dictionary).map(([value, label]) => ({ value, label }))
}

function buildCategoryOptions(categories: Array<{ id: string; name: string }>): MultiSelectOption[] {
  return categories.map((category) => ({ value: category.id, label: category.name }))
}

function buildPaginationLink(page: number, search: string, statuses: string[], categories: string[]) {
  const params = new URLSearchParams()
  params.set('page', String(page))
  if (search) params.set('search', search)
  statuses.forEach((status) => params.append('status', status))
  categories.forEach((category) => params.append('category', category))
  const query = params.toString()
  return query ? `/expenses?${query}` : '/expenses'
}

function isExpenseStatus(value: string): value is ExpenseStatus {
  return Object.values(ExpenseStatus).includes(value as ExpenseStatus)
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('hr-HR', {
    style: 'currency',
    currency,
  }).format(value)
}
