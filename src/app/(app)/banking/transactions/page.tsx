import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Prisma, MatchStatus } from "@prisma/client"
import { ResponsiveTable, type Column } from "@/components/ui/responsive-table"
import { ArrowLeftRight } from "lucide-react"

const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  UNMATCHED: "Nepovezano",
  AUTO_MATCHED: "Automatski povezano",
  MANUAL_MATCHED: "Ručno povezano",
  IGNORED: "Ignorirano",
}

const MATCH_STATUS_COLORS: Record<MatchStatus, string> = {
  UNMATCHED: "bg-warning-bg text-warning-text",
  AUTO_MATCHED: "bg-success-bg text-success-text",
  MANUAL_MATCHED: "bg-info-bg text-info-text",
  IGNORED: "bg-surface-1 text-foreground",
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
  const page = parseInt(params.page || "1")
  const pageSize = 50
  const skip = (page - 1) * pageSize

  // Get all accounts for filter
  const accounts = await db.bankAccount.findMany({
    where: { companyId: company.id },
    orderBy: { name: "asc" },
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
      orderBy: { date: "desc" },
      take: pageSize,
      skip,
    }),
    db.bankTransaction.count({ where }),
  ])

  const totalPages = Math.ceil(total / pageSize)

  type TransactionRow = (typeof transactions)[0]

  const columns: Column<TransactionRow>[] = [
    {
      key: "date",
      label: "Datum",
      render: (txn) => (
        <span className="text-sm">{new Date(txn.date).toLocaleDateString("hr-HR")}</span>
      ),
    },
    {
      key: "bankAccount",
      label: "Račun",
      render: (txn) => <span className="text-sm text-secondary">{txn.bankAccount.name}</span>,
    },
    {
      key: "description",
      label: "Opis",
      render: (txn) => (
        <div className="max-w-md">
          <div className="text-sm truncate">{txn.description}</div>
          {txn.counterpartyName && (
            <div className="text-xs text-secondary truncate">{txn.counterpartyName}</div>
          )}
          {txn.counterpartyIban && (
            <div className="text-xs text-tertiary font-mono">{txn.counterpartyIban}</div>
          )}
        </div>
      ),
    },
    {
      key: "amount",
      label: "Iznos",
      render: (txn) => (
        <span
          className={`font-mono text-sm font-semibold ${
            Number(txn.amount) >= 0 ? "text-success-text" : "text-danger-text"
          }`}
        >
          {Number(txn.amount) >= 0 ? "+" : ""}
          {formatCurrency(Number(txn.amount), txn.bankAccount.currency)}
        </span>
      ),
    },
    {
      key: "balance",
      label: "Stanje",
      render: (txn) => (
        <span className="font-mono text-sm text-secondary">
          {formatCurrency(Number(txn.balance), txn.bankAccount.currency)}
        </span>
      ),
    },
    {
      key: "matchStatus",
      label: "Status",
      render: (txn) => (
        <div>
          <span className={`text-xs px-2 py-1 rounded ${MATCH_STATUS_COLORS[txn.matchStatus]}`}>
            {MATCH_STATUS_LABELS[txn.matchStatus]}
          </span>
          {txn.matchedInvoice && (
            <div className="text-xs text-secondary mt-1">
              Račun: {txn.matchedInvoice.invoiceNumber}
            </div>
          )}
          {txn.matchedExpense && <div className="text-xs text-secondary mt-1">Trošak</div>}
        </div>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (txn) =>
        txn.matchStatus === "UNMATCHED" ? (
          <Link href={`/banking/reconciliation?transactionId=${txn.id}`}>
            <Button variant="outline" size="sm">
              Poveži
            </Button>
          </Link>
        ) : null,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transakcije</h1>
          <p className="text-secondary">Pregled bankovnih transakcija</p>
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
                  defaultValue={params.accountId || ""}
                  className="w-full rounded-md border-default text-sm"
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
                  defaultValue={params.status || ""}
                  className="w-full rounded-md border-default text-sm"
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
                  defaultValue={params.dateFrom || ""}
                  className="w-full rounded-md border-default text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Datum do</label>
                <input
                  type="date"
                  name="dateTo"
                  defaultValue={params.dateTo || ""}
                  className="w-full rounded-md border-default text-sm"
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
            <p className="text-sm text-secondary">Ukupno transakcija</p>
            <p className="text-2xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-secondary">Nepovezane</p>
            <p className="text-2xl font-bold text-warning-text">
              {transactions.filter((t) => t.matchStatus === "UNMATCHED").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-secondary">Povezane</p>
            <p className="text-2xl font-bold text-success-text">
              {
                transactions.filter(
                  (t) => t.matchStatus === "AUTO_MATCHED" || t.matchStatus === "MANUAL_MATCHED"
                ).length
              }
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-secondary">Ignorirane</p>
            <p className="text-2xl font-bold text-secondary">
              {transactions.filter((t) => t.matchStatus === "IGNORED").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      {transactions.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <EmptyState
              icon={<ArrowLeftRight className="h-8 w-8" />}
              title="Nema transakcija"
              description="Uvezite bankovni izvod u CSV formatu ili povežite račun za automatski uvoz. Transakcije možete zatim povezati s računima i troškovima."
              action={
                <Link href="/banking/import">
                  <Button>Uvezi izvod</Button>
                </Link>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <ResponsiveTable
          columns={columns}
          data={transactions}
          className="bg-[var(--surface)] rounded-2xl border border-[var(--border)]"
          getRowKey={(txn) => txn.id}
          renderCard={(txn) => (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase text-[var(--muted)] tracking-wide">
                    {new Date(txn.date).toLocaleDateString("hr-HR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  <p className="font-semibold text-[var(--foreground)]">{txn.description}</p>
                  <p className="text-sm text-[var(--muted)]">{txn.bankAccount.name}</p>
                  {txn.counterpartyName && (
                    <p className="text-xs text-[var(--muted)] mt-1">{txn.counterpartyName}</p>
                  )}
                </div>
                <div className="text-right">
                  <p
                    className={`text-lg font-semibold ${Number(txn.amount) >= 0 ? "text-success-text" : "text-danger-text"}`}
                  >
                    {Number(txn.amount) >= 0 ? "+" : ""}
                    {formatCurrency(Number(txn.amount), txn.bankAccount.currency)}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    Stanje: {formatCurrency(Number(txn.balance), txn.bankAccount.currency)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${MATCH_STATUS_COLORS[txn.matchStatus]}`}
                  >
                    {MATCH_STATUS_LABELS[txn.matchStatus]}
                  </span>
                  {txn.matchedInvoice && (
                    <p className="text-xs text-[var(--muted)] mt-1">
                      Račun: {txn.matchedInvoice.invoiceNumber}
                    </p>
                  )}
                  {txn.matchedExpense && (
                    <p className="text-xs text-[var(--muted)]">
                      Trošak: {txn.matchedExpense.description}
                    </p>
                  )}
                </div>
                {txn.matchStatus === "UNMATCHED" && (
                  <Link href={`/banking/reconciliation?transactionId=${txn.id}`}>
                    <Button variant="outline" size="sm">
                      Poveži
                    </Button>
                  </Link>
                )}
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
              href={buildPaginationLink(page - 1, params)}
              className="px-3 py-1 border rounded hover:bg-surface-1"
            >
              ← Prethodna
            </Link>
          )}
          <span className="px-3 py-1">
            Stranica {page} od {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={buildPaginationLink(page + 1, params)}
              className="px-3 py-1 border rounded hover:bg-surface-1"
            >
              Sljedeća →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function buildPaginationLink(
  page: number,
  params: {
    accountId?: string
    status?: string
    dateFrom?: string
    dateTo?: string
  }
) {
  const query = new URLSearchParams()
  query.set("page", String(page))
  if (params.accountId) query.set("accountId", params.accountId)
  if (params.status) query.set("status", params.status)
  if (params.dateFrom) query.set("dateFrom", params.dateFrom)
  if (params.dateTo) query.set("dateTo", params.dateTo)
  const qs = query.toString()
  return qs ? `/banking/transactions?${qs}` : "/banking/transactions"
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("hr-HR", {
    style: "currency",
    currency,
  }).format(value)
}
