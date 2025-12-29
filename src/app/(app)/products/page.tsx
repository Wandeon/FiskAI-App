import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { unitCodes, vatCategories } from "@/lib/validations/product"
import { ProductTable } from "@/components/products/product-table"
import { ProductHealth } from "@/components/products/product-health"
import { ProductCsvImport } from "@/components/products/product-csv-import"
import { deriveCapabilities } from "@/lib/capabilities"
import { redirect } from "next/navigation"
import { Package } from "lucide-react"
import { VisibleButton } from "@/lib/visibility"

export default async function ProductsPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const capabilities = deriveCapabilities(company)
  if (capabilities.modules.invoicing?.enabled === false) {
    redirect("/settings?tab=plan")
  }

  const products = await db.product.findMany({
    where: { companyId: company.id },
    orderBy: { name: "asc" },
    take: 50,
  })

  const unitMap = new Map<string, string>(unitCodes.map((unit) => [unit.code, unit.name]))
  const vatOptions = vatCategories.map((category) => ({
    value: category.code,
    label: category.name,
  }))
  const vatMap = new Map<string, string>(
    vatCategories.map((category) => [category.code, category.name])
  )

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
        <VisibleButton id="action:create-product" asChild>
          <Button asChild>
            <Link href="/products/new">Novi proizvod</Link>
          </Button>
        </VisibleButton>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <EmptyState
              icon={<Package className="h-8 w-8" />}
              title="Nemate još nijednog proizvoda"
              description="Proizvodi i usluge su temelj vaših računa. Dodajte ih ručno ili uvezite iz CSV datoteke."
              action={
                <VisibleButton id="action:create-product" asChild>
                  <Button asChild>
                    <Link href="/products/new">Dodaj prvi proizvod</Link>
                  </Button>
                </VisibleButton>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <ProductHealth
            total={products.length}
            inactiveCount={products.filter((product) => !product.isActive).length}
            missingSkuCount={products.filter((product) => !product.sku).length}
            zeroPriceCount={products.filter((product) => Number(product.price) === 0).length}
          />
          <ProductCsvImport />
          <ProductTable products={tableProducts} vatOptions={vatOptions} />
        </>
      )}
    </div>
  )
}
