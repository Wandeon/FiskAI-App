import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ExpenseForm } from "./expense-form"

export default async function NewExpensePage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const [vendors, categories] = await Promise.all([
    db.contact.findMany({
      where: { companyId: company.id, type: { in: ["SUPPLIER", "BOTH"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.expenseCategory.findMany({
      where: { OR: [{ companyId: company.id }, { companyId: null }], isActive: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Novi trošak</h1>
          <p className="text-secondary">Evidentirajte novi poslovni trošak</p>
        </div>
        <Link href="/expenses">
          <Button variant="outline">← Natrag</Button>
        </Link>
      </div>
      <ExpenseForm vendors={vendors} categories={categories} />
    </div>
  )
}
