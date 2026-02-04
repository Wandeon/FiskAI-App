import Link from "next/link"
import { Package, Plus } from "lucide-react"
import { getProducts } from "./actions"
import { ProductTable } from "@/components/products"
import { EmptyState } from "@/components/ui/empty-state"

interface ProductsPageProps {
  searchParams: Promise<{
    search?: string
    status?: string
  }>
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams
  const search = params.search || ""
  const status = (params.status as "ALL" | "ACTIVE" | "INACTIVE") || "ALL"

  const products = await getProducts({ search, status })

  // Check if there are any products at all (without filters)
  const hasAnyProducts = products.length > 0 || search !== "" || status !== "ALL"
  const allProducts = hasAnyProducts ? products : await getProducts()
  const totalProducts = search === "" && status === "ALL" ? products.length : allProducts.length

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white">
              Proizvodi i usluge
            </h1>
            <p className="text-white/60 mt-1">
              Upravljajte proizvodima i uslugama za fakturiranje
            </p>
          </div>
          <Link
            href="/products/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all"
          >
            <Plus className="h-4 w-4" />
            Novi proizvod
          </Link>
        </div>

        {/* Content */}
        {totalProducts === 0 ? (
          <EmptyState
            icon={<Package className="h-8 w-8" />}
            title="Nemate proizvoda"
            description="Dodajte prvi proizvod ili uslugu da biste mogli kreirati racune"
            action={
              <Link
                href="/products/new"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all"
              >
                <Plus className="h-4 w-4" />
                Dodaj proizvod
              </Link>
            }
            className="bg-white/5 rounded-2xl border border-white/10 py-16"
          />
        ) : products.length === 0 ? (
          <EmptyState
            icon={<Package className="h-8 w-8" />}
            title="Nema rezultata"
            description={`Nema proizvoda koji odgovaraju pretrazi "${search}"`}
            className="bg-white/5 rounded-2xl border border-white/10 py-16"
          />
        ) : (
          <>
            {/* Results Count */}
            <p className="text-sm text-white/50 mb-4">
              Prikazano {products.length} proizvoda
            </p>

            {/* Product Table */}
            <ProductTable products={products} search={search} status={status} />
          </>
        )}
      </div>
    </div>
  )
}
