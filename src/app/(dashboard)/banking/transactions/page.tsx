import { requireAuth, requireCompany } from '@/lib/auth-utils'
import { db } from '@/lib/db'
import { setTenantContext } from '@/lib/prisma-extensions'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { Prisma, MatchStatus } from '@prisma/client'

const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  UNMATCHED: 'Nepovezano',
  AUTO_MATCHED: 'Automatski povezano',
  MANUAL_MATCHED: 'Ručno povezano',
  IGNORED: 'Ignorirano',
}

const MATCH_STATUS_COLORS: Record<MatchStatus, string> = {
  UNMATCHED: 'bg-orange-100 text-orange-800',
  AUTO_MATCHED: 'bg-green-100 text-green-800',
  MANUAL_MATCHED: 'bg-blue-100 text-blue-800',
  IGNORED: 'bg-gray-100 text-gray-800',
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    accountId?: string
    status?: string
    dateFrom?: string
    dateTo?: string
    page?: string
  }>
}) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const params = await searchParams
  const page = parseInt(params.page || '1')
  const pageSize = 50
  const skip = (page - 1) * pageSize

  // Get all accounts for filter
  const accounts = await db.bankAccount.findMany({
    where: { companyId: company.id },
    orderBy: { name: 'asc' },
  })

  // Build filter
  const where: Prisma.BankTransactionWhereInput = {
    companyId: company.id,
  }

  if (params.accountId) {
    where.bankAccountId = params.accountId
  }

  if (params.status && params.status in MatchStatus) {
    where.matchStatus = params.status as MatchStatus
  }

  if (params.dateFrom || params.dateTo) {
    where.date = {}
    if (params.dateFrom) {
      where.date.gte = new Date(params.dateFrom)
    }
    if (params.dateTo) {
      where.date.lte = new Date(params.dateTo)
    }
  }

  const [transactions, total] = await Promise.all([
    db.bankTransaction.findMany({
      where,
      include: {
        bankAccount: {
          select: { name: true, currency: true },
        },
        matchedInvoice: {
          select: { invoiceNumber: true },
        },
        matchedExpense: {
          select: { id: true, description: true },
        },
      },
      orderBy: { date: 'desc' },
      take: pageSize,
      skip,
    }),
    db.bankTransaction.count({ where }),
  ])

  const totalPages = Math.ceil(total / pageSize)

  type TransactionRow = (typeof transactions)[0]

  const columns = [
    {
      key: 'date',
      header: 'Datum',
      cell: (txn: TransactionRow) => (
        <span className="text-sm">
          {new Date(txn.date).toLocaleDateString('hr-HR')}
        </span>
      ),
    },
    {
      key: 'bankAccount',
      header: 'Račun',
      cell: (txn: TransactionRow) => (
        <span className="text-sm text-gray-600">{txn.bankAccount.name}</span>
      ),
    },
    {
      key: 'description',
      header: 'Opis',
      cell: (txn: TransactionRow) => (
        <div className="max-w-md">
          <div className="text-sm truncate">{txn.description}</div>
          {txn.counterpartyName && (
            <div className="text-xs text-gray-500 truncate">{txn.counterpartyName}</div>
          )}
          {txn.counterpartyIban && (
            <div className="text-xs text-gray-400 font-mono">{txn.counterpartyIban}</div>
          )}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Iznos',
      cell: (txn: TransactionRow) => (
        <span
          className={`font-mono text-sm font-semibold ${
            Number(txn.amount) >= 0 ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {Number(txn.amount) >= 0 ? '+' : ''}
          {new Intl.NumberFormat('hr-HR', {
            style: 'currency',
            currency: txn.bankAccount.currency,
          }).format(Number(txn.amount))}
        </span>
      ),
    },
    {
      key: 'balance',
      header: 'Stanje',
      cell: (txn: TransactionRow) => (
        <span className="font-mono text-sm text-gray-600">
          {new Intl.NumberFormat('hr-HR', {
            style: 'currency',
            currency: txn.bankAccount.currency,
          }).format(Number(txn.balance))}
        </span>
      ),
    },
    {
      key: 'matchStatus',
      header: 'Status',
      cell: (txn: TransactionRow) => (
        <div>
          <span
            className={`text-xs px-2 py-1 rounded ${
              MATCH_STATUS_COLORS[txn.matchStatus]
            }`}
          >
            {MATCH_STATUS_LABELS[txn.matchStatus]}
          </span>
          {txn.matchedInvoice && (
            <div className="text-xs text-gray-500 mt-1">
              Račun: {txn.matchedInvoice.invoiceNumber}
            </div>
          )}
          {txn.matchedExpense && (
            <div className="text-xs text-gray-500 mt-1">Trošak</div>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (txn: TransactionRow) =>
        txn.matchStatus === 'UNMATCHED' ? (
          <Button variant="outline" size="sm">
            Poveži
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transakcije</h1>
          <p className="text-gray-500">Pregled bankovnih transakcija</p>
        </div>
        <div className="flex gap-2">
          <Link href="/banking/import">
            <Button variant="outline">Uvoz izvoda</Button>
          </Link>
          <Link href="/banking">
            <Button variant="outline">Natrag na bankarstvo</Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Račun</label>
                <select
                  name="accountId"
                  defaultValue={params.accountId || ''}
                  className="w-full rounded-md border-gray-300 text-sm"
                >
                  <option value="">Svi računi</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Status povezanosti</label>
                <select
                  name="status"
                  defaultValue={params.status || ''}
                  className="w-full rounded-md border-gray-300 text-sm"
                >
                  <option value="">Svi statusi</option>
                  {Object.entries(MATCH_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Datum od</label>
                <input
                  type="date"
                  name="dateFrom"
                  defaultValue={params.dateFrom || ''}
                  className="w-full rounded-md border-gray-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Datum do</label>
                <input
                  type="date"
                  name="dateTo"
                  defaultValue={params.dateTo || ''}
                  className="w-full rounded-md border-gray-300 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" variant="outline" size="sm">
                Filtriraj
              </Button>
              {(params.accountId || params.status || params.dateFrom || params.dateTo) && (
                <Link href="/banking/transactions">
                  <Button variant="ghost" size="sm">
                    Očisti
                  </Button>
                </Link>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Ukupno transakcija</p>
            <p className="text-2xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Nepovezane</p>
            <p className="text-2xl font-bold text-orange-600">
              {transactions.filter((t) => t.matchStatus === 'UNMATCHED').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Povezane</p>
            <p className="text-2xl font-bold text-green-600">
              {
                transactions.filter(
                  (t) =>
                    t.matchStatus === 'AUTO_MATCHED' || t.matchStatus === 'MANUAL_MATCHED'
                ).length
              }
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500">Ignorirane</p>
            <p className="text-2xl font-bold text-gray-600">
              {transactions.filter((t) => t.matchStatus === 'IGNORED').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      {transactions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">Nema transakcija</p>
            <Link href="/banking/import">
              <Button>Uvezi izvod</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={transactions}
          caption="Popis transakcija"
          getRowKey={(txn) => txn.id}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Link
              href={`?page=${page - 1}${params.accountId ? `&accountId=${params.accountId}` : ''}${params.status ? `&status=${params.status}` : ''}${params.dateFrom ? `&dateFrom=${params.dateFrom}` : ''}${params.dateTo ? `&dateTo=${params.dateTo}` : ''}`}
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
              href={`?page=${page + 1}${params.accountId ? `&accountId=${params.accountId}` : ''}${params.status ? `&status=${params.status}` : ''}${params.dateFrom ? `&dateFrom=${params.dateFrom}` : ''}${params.dateTo ? `&dateTo=${params.dateTo}` : ''}`}
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
