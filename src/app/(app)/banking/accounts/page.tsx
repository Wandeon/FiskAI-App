import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { AccountForm } from "./account-form"
import { setDefaultBankAccount, deleteBankAccount } from "../actions"
import { Landmark } from "lucide-react"

export default async function BankAccountsPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const accounts = await db.bankAccount.findMany({
    where: { companyId: company.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    include: {
      _count: {
        select: { transactions: true },
      },
    },
  })

  async function handleSetDefault(formData: FormData) {
    "use server"
    const accountId = formData.get("accountId") as string
    await setDefaultBankAccount(accountId)
  }

  async function handleDelete(formData: FormData) {
    "use server"
    const accountId = formData.get("accountId") as string
    await deleteBankAccount(accountId)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bankovni računi</h1>
          <p className="text-secondary">Upravljanje bankovnim računima tvrtke</p>
        </div>
        <Link href="/banking">
          <Button variant="outline">Natrag na bankarstvo</Button>
        </Link>
      </div>

      {/* Add New Account Form */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">Dodaj novi račun</h2>
          <AccountForm />
        </CardContent>
      </Card>

      {/* Existing Accounts */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Postojeći računi</h2>
        {accounts.length === 0 ? (
          <Card>
            <CardContent className="py-6">
              <EmptyState
                icon={<Landmark className="h-8 w-8" />}
                title="Nemate dodanih bankovnih računa"
                description="Koristite obrazac iznad za dodavanje prvog bankovnog računa. Nakon toga možete uvoziti izvode i pratiti transakcije."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => (
              <Card key={account.id} className={account.isDefault ? "ring-2 ring-info-border" : ""}>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{account.name}</h3>
                        {account.isDefault && (
                          <span className="text-xs bg-info-bg text-info-text px-2 py-1 rounded">
                            Zadani račun
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 text-sm">
                        <div>
                          <span className="text-secondary">IBAN:</span>{" "}
                          <span className="font-mono">{account.iban}</span>
                        </div>
                        <div>
                          <span className="text-secondary">Banka:</span>{" "}
                          <span>{account.bankName}</span>
                        </div>
                        <div>
                          <span className="text-secondary">Valuta:</span>{" "}
                          <span>{account.currency}</span>
                        </div>
                        <div>
                          <span className="text-secondary">Transakcija:</span>{" "}
                          <span>{account._count.transactions}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col justify-between">
                      <div>
                        <p className="text-sm text-secondary">Trenutno stanje</p>
                        <p className="text-2xl font-bold">
                          {new Intl.NumberFormat("hr-HR", {
                            style: "currency",
                            currency: account.currency,
                          }).format(Number(account.currentBalance))}
                        </p>
                        {account.lastSyncAt && (
                          <p className="text-xs text-secondary mt-1">
                            Zadnja sinkronizacija:{" "}
                            {new Date(account.lastSyncAt).toLocaleString("hr-HR")}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 mt-4">
                        {!account.isDefault && (
                          <form action={handleSetDefault}>
                            <input type="hidden" name="accountId" value={account.id} />
                            <Button type="submit" variant="outline" size="sm">
                              Postavi kao zadani
                            </Button>
                          </form>
                        )}
                        {account._count.transactions === 0 && (
                          <form action={handleDelete}>
                            <input type="hidden" name="accountId" value={account.id} />
                            <Button type="submit" variant="outline" size="sm">
                              Obriši
                            </Button>
                          </form>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
