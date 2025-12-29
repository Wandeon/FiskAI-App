import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ConnectButton } from "./components/connect-button"
import { ConnectionBadge } from "./components/connection-badge"
import { Landmark, ArrowLeftRight } from "lucide-react"

export default async function BankingPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  // Fetch bank accounts
  const accounts = await db.bankAccount.findMany({
    where: { companyId: company.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  })

  // Calculate total balance per currency
  const balancesByCurrency = accounts.reduce(
    (acc, account) => {
      const currency = account.currency
      const balance = Number(account.currentBalance)
      acc[currency] = (acc[currency] || 0) + balance
      return acc
    },
    {} as Record<string, number>
  )

  // Get unmatched transactions count
  const unmatchedCount = await db.bankTransaction.count({
    where: {
      companyId: company.id,
      matchStatus: "UNMATCHED",
    },
  })

  // Get recent transactions
  const recentTransactions = await db.bankTransaction.findMany({
    where: { companyId: company.id },
    include: {
      bankAccount: {
        select: { name: true, currency: true },
      },
    },
    orderBy: { date: "desc" },
    take: 10,
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bankarstvo</h1>
          <p className="text-secondary">Upravljanje bankovnim računima i transakcijama</p>
        </div>
        <div className="flex gap-2">
          <Link href="/banking/import">
            <Button variant="outline">Uvoz izvoda</Button>
          </Link>
          <Link href="/banking/reconciliation">
            <Button variant="ghost">Pomirenje</Button>
          </Link>
          <Link href="/banking/accounts">
            <Button>Upravljaj računima</Button>
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-secondary mb-1">Ukupno stanje</p>
            <div className="space-y-1">
              {Object.entries(balancesByCurrency).map(([currency, balance]) => (
                <p key={currency} className="text-3xl font-bold">
                  {new Intl.NumberFormat("hr-HR", {
                    style: "currency",
                    currency,
                  }).format(balance)}
                </p>
              ))}
              {Object.keys(balancesByCurrency).length === 0 && (
                <p className="text-3xl font-bold">
                  {new Intl.NumberFormat("hr-HR", {
                    style: "currency",
                    currency: "EUR",
                  }).format(0)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-secondary mb-1">Broj računa</p>
            <p className="text-3xl font-bold">{accounts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-secondary mb-1">Nepovezane transakcije</p>
            <p className="text-3xl font-bold text-warning-text">{unmatchedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Bank Accounts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Bankovni računi</h2>
          <Link href="/banking/accounts">
            <Button variant="outline" size="sm">
              Vidi sve
            </Button>
          </Link>
        </div>
        {accounts.length === 0 ? (
          <Card>
            <CardContent className="py-6">
              <EmptyState
                icon={<Landmark className="h-8 w-8" />}
                title="Nemate dodanih bankovnih računa"
                description="Povežite svoje bankovne račune za automatski uvoz transakcija i lakše vođenje knjiga. Podržavamo većinu hrvatskih banaka."
                action={
                  <Link href="/banking/accounts">
                    <Button>Dodaj prvi račun</Button>
                  </Link>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => (
              <Card key={account.id} className={account.isDefault ? "ring-2 ring-info-border" : ""}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold">{account.name}</p>
                      {account.isDefault && (
                        <span className="text-xs bg-info-bg text-info-text px-2 py-0.5 rounded">
                          Zadani
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-secondary font-mono mb-3">{account.iban}</p>
                  <p className="text-sm text-secondary mb-3">{account.bankName}</p>
                  <div className="border-t pt-3 mb-3">
                    <p className="text-xs text-secondary">Saldo</p>
                    <p className="text-xl font-bold">
                      {new Intl.NumberFormat("hr-HR", {
                        style: "currency",
                        currency: account.currency,
                      }).format(Number(account.currentBalance))}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-3 border-t">
                    <ConnectionBadge
                      status={account.connectionStatus}
                      expiresAt={account.connectionExpiresAt}
                    />
                    <ConnectButton
                      bankAccountId={account.id}
                      connectionStatus={account.connectionStatus}
                      bankName={account.bankName}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Nedavne transakcije</h2>
          <Link href="/banking/transactions">
            <Button variant="outline" size="sm">
              Vidi sve
            </Button>
          </Link>
        </div>
        {recentTransactions.length === 0 ? (
          <Card>
            <CardContent className="py-6">
              <EmptyState
                icon={<ArrowLeftRight className="h-8 w-8" />}
                title="Nema transakcija"
                description="Uvezite bankovni izvod kako biste mogli pratiti prihode i rashode te povezivati transakcije s računima."
                action={
                  <Link href="/banking/import">
                    <Button>Uvezi izvod</Button>
                  </Link>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-1 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase">
                        Datum
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase">
                        Račun
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase">
                        Opis
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-secondary uppercase">
                        Iznos
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-secondary uppercase">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentTransactions.map((txn) => (
                      <tr key={txn.id} className="hover:bg-surface-1">
                        <td className="px-4 py-3 text-sm">
                          {new Date(txn.date).toLocaleDateString("hr-HR")}
                        </td>
                        <td className="px-4 py-3 text-sm text-secondary">{txn.bankAccount.name}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="max-w-xs truncate">{txn.description}</div>
                          {txn.counterpartyName && (
                            <div className="text-xs text-secondary">{txn.counterpartyName}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-mono">
                          <span
                            className={Number(txn.amount) >= 0 ? "text-success-text" : "text-danger-text"}
                          >
                            {Number(txn.amount) >= 0 ? "+" : ""}
                            {new Intl.NumberFormat("hr-HR", {
                              style: "currency",
                              currency: txn.bankAccount.currency,
                            }).format(Number(txn.amount))}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {txn.matchStatus === "UNMATCHED" ? (
                            <span className="text-xs bg-warning-bg text-warning-text px-2 py-1 rounded">
                              Nepovezano
                            </span>
                          ) : txn.matchStatus === "AUTO_MATCHED" ||
                            txn.matchStatus === "MANUAL_MATCHED" ? (
                            <span className="text-xs bg-success-bg text-success-text px-2 py-1 rounded">
                              Povezano
                            </span>
                          ) : (
                            <span className="text-xs bg-surface-1 text-foreground px-2 py-1 rounded">
                              Ignorirano
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
