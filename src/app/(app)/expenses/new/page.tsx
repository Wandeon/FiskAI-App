import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import { resolveCapabilityForUser } from "@/lib/capabilities/server"
import { BlockerDisplay } from "@/components/capability"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ExpenseForm } from "./expense-form"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

export default async function NewExpensePage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  // Check capability before allowing access
  const capability = await resolveCapabilityForUser("EXP-001", {
    entityType: "Expense",
  })

  if (capability.state === "UNAUTHORIZED") {
    redirect("/cc")
  }

  if (capability.state === "BLOCKED") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Nije moguće kreirati trošak</h1>
        <BlockerDisplay blockers={capability.blockers} />
        <Link href="/cc">
          <Button>Povratak na Kontrolni centar</Button>
        </Link>
      </div>
    )
  }

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
          <p className="text-muted-foreground">
            Spremi nacrt, zatim koristi Kontrolni centar za daljnje akcije.
          </p>
        </div>
        <Link href="/cc">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kontrolni centar
          </Button>
        </Link>
      </div>
      <ExpenseForm vendors={vendors} categories={categories} />
    </div>
  )
}
