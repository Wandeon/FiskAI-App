import { requireAuth, requireCompany } from '@/lib/auth-utils'
import { db } from '@/lib/db'
import { setTenantContext } from '@/lib/prisma-extensions'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

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
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  })

  // Calculate total balance
  const totalBalance = accounts.reduce(
    (sum, acc) => sum + Number(acc.currentBalance),
    0
  )

  // Get unmatched transactions count
  const unmatchedCount = await db.bankTransaction.count({
    where: {
      companyId: company.id,
      matchStatus: 'UNMATCHED',
    },
  })

  // Get recent transactions
  const recentTransactions = await db.bankTransaction.findMany({
    where: { companyId: company.id },
    include: {
      bankAccount: {
        select: { name: true },
      },
    },
    orderBy: { date: 'desc' },
    take: 10,
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bankarstvo</h1>
          <p className="text-gray-500">Upravljanje bankovnim računima i transakcijama</p>
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
            <p className="text-sm text-gray-500 mb-1">Ukupno stanje</p>
            <p className="text-3xl font-bold">
              {new Intl.NumberFormat('hr-HR', {
                style: 'currency',
                currency: 'EUR',
              }).format(totalBalance)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500 mb-1">Broj računa</p>
            <p className="text-3xl font-bold">{accounts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500 mb-1">Nepovezane transakcije</p>
            <p className="text-3xl font-bold text-orange-600">{unmatchedCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Bank Accounts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Bankovni računi</h2>
          <Link href="/banking/accounts">
            <Button variant="outline" size="sm">Vidi sve</Button>
          </Link>
        </div>
        {accounts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500 mb-4">Nemate dodanih bankovnih računa</p>
              <Link href="/banking/accounts">
                <Button>Dodaj račun</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => (
              <Card key={account.id} className={account.isDefault ? 'ring-2 ring-blue-500' : ''}>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold">{account.name}</p>
                      {account.isDefault && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          Zadani
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 font-mono mb-3">{account.iban}</p>
                  <p className="text-sm text-gray-600 mb-3">{account.bankName}</p>
                  <div className="border-t pt-3">
                    <p className="text-xs text-gray-500">Saldo</p>
                    <p className="text-xl font-bold">
                      {new Intl.NumberFormat('hr-HR', {
                        style: 'currency',
                        currency: account.currency,
                      }).format(Number(account.currentBalance))}
                    </p>
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
            <Button variant="outline" size="sm">Vidi sve</Button>
          </Link>
        </div>
        {recentTransactions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500 mb-4">Nema transakcija</p>
              <Link href="/banking/import">
                <Button>Uvezi izvod</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Datum
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Račun
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Opis
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Iznos
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {recentTransactions.map((txn) => (
                      <tr key={txn.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">
                          {new Date(txn.date).toLocaleDateString('hr-HR')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {txn.bankAccount.name}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="max-w-xs truncate">{txn.description}</div>
                          {txn.counterpartyName && (
                            <div className="text-xs text-gray-500">{txn.counterpartyName}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-mono">
                          <span
                            className={
                              Number(txn.amount) >= 0 ? 'text-green-600' : 'text-red-600'
                            }
                          >
                            {Number(txn.amount) >= 0 ? '+' : ''}
                            {new Intl.NumberFormat('hr-HR', {
                              style: 'currency',
                              currency: 'EUR',
                            }).format(Number(txn.amount))}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {txn.matchStatus === 'UNMATCHED' ? (
                            <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                              Nepovezano
                            </span>
                          ) : txn.matchStatus === 'AUTO_MATCHED' || txn.matchStatus === 'MANUAL_MATCHED' ? (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                              Povezano
                            </span>
                          ) : (
                            <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
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
