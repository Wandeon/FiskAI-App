import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { unitCodes, vatCategories } from "@/lib/validations/product"
import { ProductTable } from "@/components/products/product-table"

export default async function ProductsPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const products = await db.product.findMany({
    where: { companyId: company.id },
    orderBy: { name: "asc" },
  })

  const unitMap = new Map<string, string>(unitCodes.map((unit) => [unit.code, unit.name]))
  const vatOptions = vatCategories.map((category) => ({
    value: category.code,
    label: category.name,
  }))
  const vatMap = new Map<string, string>(vatCategories.map((category) => [category.code, category.name]))

  const tableProducts = products.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    sku: product.sku,
    price: Number(product.price),
    unit: product.unit,
    unitLabel: unitMap.get(product.unit) ?? product.unit,
    vatRate: Number(product.vatRate),
    vatCategory: product.vatCategory,
    vatLabel: vatMap.get(product.vatCategory) ?? product.vatCategory,
    isActive: product.isActive,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Proizvodi i usluge</h1>
        <Link href="/products/new">
          <Button>Novi proizvod</Button>
        </Link>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-gray-500 mb-4">Nemate još nijednog proizvoda</p>
            <Link href="/products/new">
              <Button>Dodaj prvi proizvod</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ProductTable products={tableProducts} vatOptions={vatOptions} />
      )}
    </div>
  )
}
