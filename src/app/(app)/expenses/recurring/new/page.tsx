import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { setTenantContext } from "@/lib/prisma-extensions"
import { db } from "@/lib/db"
import { RecurringExpenseForm } from "./recurring-expense-form"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default async function NewRecurringExpensePage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  // Fetch vendors (contacts that are suppliers)
  const vendors = await db.contact.findMany({
    where: {
      companyId: company.id,
      type: { in: ["SUPPLIER", "BOTH"] },
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  })

  // Fetch expense categories
  const categories = await db.expenseCategory.findMany({
    where: {
      OR: [{ companyId: company.id }, { companyId: null }],
      isActive: true,
    },
    orderBy: { name: "asc" },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/expenses/recurring">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Novi ponavljajući trošak</h1>
          <p className="text-[var(--muted)]">
            Definirajte trošak koji se automatski ponavlja u određenim intervalima
          </p>
        </div>
      </div>

      <RecurringExpenseForm vendors={vendors} categories={categories} />
    </div>
  )
}
