'use client'

import { useMemo, useState } from "react"
import Link from "next/link"
import { MultiSelect, MultiSelectOption } from "@/components/ui/multi-select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { DeleteProductButton } from "@/app/(dashboard)/products/delete-button"
import { cn } from "@/lib/utils"

type ProductRow = {
  id: string
  name: string
  description?: string | null
  sku?: string | null
  price: number
  unit: string
  unitLabel: string
  vatRate: number
  vatCategory: string
  vatLabel: string
  isActive: boolean
}

interface ProductTableProps {
  products: ProductRow[]
  vatOptions: MultiSelectOption[]
}

const statusOptions: MultiSelectOption[] = [
  { label: "Aktivni", value: "ACTIVE" },
  { label: "Neaktivni", value: "INACTIVE" },
]

export function ProductTable({ products, vatOptions }: ProductTableProps) {
  const [search, setSearch] = useState("")
  const [selectedVat, setSelectedVat] = useState<MultiSelectOption[]>([])
  const [selectedStatus, setSelectedStatus] = useState<MultiSelectOption[]>([])

  const filteredProducts = useMemo(() => {
    const searchTerm = search.trim().toLowerCase()
    const vatFilter = new Set(selectedVat.map((item) => item.value))
    const statusFilter = new Set(selectedStatus.map((item) => item.value))

    return products.filter((product) => {
      if (searchTerm.length > 0) {
        const matchesSearch =
          product.name.toLowerCase().includes(searchTerm) ||
          (product.sku ?? "").toLowerCase().includes(searchTerm) ||
          (product.description ?? "").toLowerCase().includes(searchTerm)
        if (!matchesSearch) return false
      }

      if (vatFilter.size > 0 && !vatFilter.has(product.vatCategory)) {
        return false
      }

      if (statusFilter.size > 0) {
        const status = product.isActive ? "ACTIVE" : "INACTIVE"
        if (!statusFilter.has(status)) {
          return false
        }
      }

      return true
    })
  }, [products, search, selectedVat, selectedStatus])

  const totalActive = products.filter((product) => product.isActive).length
  const hasFilters = selectedVat.length > 0 || selectedStatus.length > 0 || search.length > 0

  const clearFilters = () => {
    setSearch("")
    setSelectedVat([])
    setSelectedStatus([])
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-[var(--muted)]">Pretraži proizvode</label>
          <Input
            placeholder="Naziv, šifra ili opis"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-[var(--muted)]">PDV kategorije</label>
          <MultiSelect
            options={vatOptions}
            value={selectedVat}
            onChange={setSelectedVat}
            placeholder="Sve kategorije"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-[var(--muted)]">Status</label>
          <MultiSelect
            options={statusOptions}
            value={selectedStatus}
            onChange={setSelectedStatus}
            placeholder="Svi statusi"
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-[var(--muted)]">
        <p>
          Prikazano <span className="font-semibold text-[var(--foreground)]">{filteredProducts.length}</span> od{" "}
          <span className="font-semibold text-[var(--foreground)]">{products.length}</span> proizvoda
          {" · "}
          Aktivni: <span className="font-semibold text-[var(--foreground)]">{totalActive}</span>
        </p>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Resetiraj filtre
          </Button>
        )}
      </div>

      {filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--muted)]">
          Nema rezultata za zadane filtere. Pokušajte proširiti pretragu.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-secondary)]/60 text-left text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                <th className="px-4 py-3">Naziv</th>
                <th className="px-4 py-3">Šifra</th>
                <th className="px-4 py-3 text-right">Cijena</th>
                <th className="px-4 py-3 text-center">Jedinica</th>
                <th className="px-4 py-3 text-center">PDV</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Akcije</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id} className="border-b border-[var(--border)] last:border-0 even:bg-[var(--surface-secondary)]/30">
                  <td className="px-4 py-4 align-top">
                    <p className="font-medium text-[var(--foreground)]">{product.name}</p>
                    {product.description && (
                      <p className="text-sm text-[var(--muted)] truncate max-w-xs">{product.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-[var(--muted)]">
                    {product.sku || "—"}
                  </td>
                  <td className="px-4 py-4 align-top text-right font-mono text-sm text-[var(--foreground)]">
                    {formatCurrency(product.price)}
                  </td>
                  <td className="px-4 py-4 align-top text-center text-sm text-[var(--foreground)]">
                    <span className="font-medium">{product.unitLabel}</span>
                    <p className="text-xs text-[var(--muted)]">{product.unit}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-center text-sm text-[var(--foreground)]">
                    <div className="space-y-1">
                      <span className="font-semibold">{product.vatRate}%</span>
                      <p className="text-xs text-[var(--muted)]">{product.vatLabel}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top text-center">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-3 py-0.5 text-xs font-semibold",
                        product.isActive
                          ? "bg-success-100 text-success-700"
                          : "bg-[var(--surface-secondary)] text-[var(--muted)]"
                      )}
                    >
                      {product.isActive ? "Aktivan" : "Neaktivan"}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex justify-end gap-2">
                      <Link href={`/products/${product.id}/edit`}>
                        <Button variant="outline" size="sm">
                          Uredi
                        </Button>
                      </Link>
                      <DeleteProductButton productId={product.id} productName={product.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("hr-HR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}
