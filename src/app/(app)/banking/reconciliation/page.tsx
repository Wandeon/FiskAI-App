import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ReconciliationDashboard } from "./dashboard-client"

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{
    transactionId?: string
  }>
}) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const params = await searchParams
  const accounts = await db.bankAccount.findMany({
    where: { companyId: company.id },
    orderBy: { name: "asc" },
  })

  // If transactionId is provided, get the transaction to determine the bank account
  let defaultAccountId = accounts[0]?.id
  if (params.transactionId) {
    const transaction = await db.bankTransaction.findFirst({
      where: {
        id: params.transactionId,
        companyId: company.id,
      },
      select: { bankAccountId: true },
    })
    if (transaction) {
      defaultAccountId = transaction.bankAccountId
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bankovna pomirenja</h1>
          <p className="text-sm text-gray-500">
            Brzo vidite koje transakcije trebaju ručno povezivanje.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/banking/import">
            <Button variant="outline">Uvezi izvod</Button>
          </Link>
          <Link href="/banking/transactions">
            <Button variant="ghost">Pregled transakcija</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-lg font-semibold">Kako to radi</h2>
          <p className="text-sm text-gray-600">
            Svaki CSV automatizirano prolazi kroz parser i uspoređuje se s neplaćenim računima.
            Računi s konfidentnim podudaranjem (≥85%) automatski se označavaju kao plaćeni. Sve
            ostalo čeka ovdje za manualnu potvrdu.
          </p>
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>Pokušajte uvesti izvode što češće kako bi AI imao najnovije podatke.</li>
            <li>Ručno povežite retke s najvišom ocjenom kad AI ne može automatski odlučiti.</li>
            <li>Pritisnite „Poveži" i status će se odmah promijeniti u „Ručno".</li>
          </ul>
        </CardContent>
      </Card>

      <ReconciliationDashboard
        accounts={accounts.map((account) => ({
          id: account.id,
          name: `${account.name} (${account.currency})`,
          currency: account.currency,
        }))}
        defaultBankAccountId={defaultAccountId}
        highlightTransactionId={params.transactionId}
      />
    </div>
  )
}
