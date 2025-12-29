import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CategoryForm } from "./category-form"
import { CategoryItem } from "./category-item"
import { SeedButton } from "./seed-button"

export default async function ExpenseCategoriesPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  setTenantContext({ companyId: company.id, userId: user.id! })

  const categories = await db.expenseCategory.findMany({
    where: { OR: [{ companyId: company.id }, { companyId: null }] },
    include: { _count: { select: { expenses: true } } },
    orderBy: { name: "asc" },
  })

  const companyCategories = categories.filter((c) => c.companyId === company.id)
  const systemCategories = categories.filter((c) => c.companyId === null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kategorije troškova</h1>
          <p className="text-secondary">Upravljanje kategorijama za klasifikaciju troškova</p>
        </div>
        <div className="flex gap-2">
          <Link href="/expenses">
            <Button variant="outline">← Natrag</Button>
          </Link>
          {companyCategories.length === 0 && <SeedButton />}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova kategorija</CardTitle>
          <CardDescription>Dodajte vlastitu kategoriju troškova</CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryForm />
        </CardContent>
      </Card>

      {companyCategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vaše kategorije</CardTitle>
            <CardDescription>
              Možete uređivati i brisati vaše kategorije (sistemske kategorije se ne mogu mijenjati)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {companyCategories.map((cat) => (
                <CategoryItem key={cat.id} category={cat} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {systemCategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sistemske kategorije</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {systemCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between py-2 px-3 bg-surface-1 rounded opacity-75"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm bg-[var(--surface)] px-2 py-0.5 rounded border">
                      {cat.code}
                    </span>
                    <span>{cat.name}</span>
                  </div>
                  <span className="text-xs text-secondary">Sistemska</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
