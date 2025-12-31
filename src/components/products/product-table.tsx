"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { MultiSelect, MultiSelectOption } from "@/components/ui/multi-select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
// eslint-disable-next-line import/no-restricted-paths -- pre-existing import, to be refactored
import { DeleteProductButton } from "@/app/(app)/products/delete-button"
import { cn } from "@/lib/utils"
// eslint-disable-next-line import/no-restricted-paths -- pre-existing import, to be refactored
import { updateProductInline } from "@/app/actions/product"
import { toast } from "@/lib/toast"
import { Loader2, Check, XCircle } from "lucide-react"

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
  const [drafts, setDrafts] = useState<Record<string, { price: string; isActive: boolean }>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)

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
          Prikazano{" "}
          <span className="font-semibold text-[var(--foreground)]">{filteredProducts.length}</span>{" "}
          od <span className="font-semibold text-[var(--foreground)]">{products.length}</span>{" "}
          proizvoda
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
                <tr
                  key={product.id}
                  className="border-b border-[var(--border)] last:border-0 even:bg-[var(--surface-secondary)]/30"
                >
                  <td className="px-4 py-4 align-top">
                    <p className="font-medium text-[var(--foreground)]">{product.name}</p>
                    {product.description && (
                      <p className="text-sm text-[var(--muted)] truncate max-w-xs">
                        {product.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-[var(--muted)]">
                    {product.sku || "—"}
                  </td>
                  <td className="px-4 py-4 align-top text-right font-mono text-sm text-[var(--foreground)]">
                    <Input
                      value={drafts[product.id]?.price ?? product.price.toString()}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [product.id]: {
                            price: e.target.value,
                            isActive: prev[product.id]?.isActive ?? product.isActive,
                          },
                        }))
                      }
                      className="h-8 w-32 text-right"
                      type="number"
                      step="0.01"
                    />
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
                    <button
                      type="button"
                      onClick={() =>
                        setDrafts((prev) => ({
                          ...prev,
                          [product.id]: {
                            price: prev[product.id]?.price ?? product.price.toString(),
                            isActive: !(prev[product.id]?.isActive ?? product.isActive),
                          },
                        }))
                      }
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full px-3 py-0.5 text-xs font-semibold transition",
                        (drafts[product.id]?.isActive ?? product.isActive)
                          ? "bg-success-100 text-success-700"
                          : "bg-[var(--surface-secondary)] text-[var(--muted)] hover:text-[var(--foreground)]"
                      )}
                    >
                      {(drafts[product.id]?.isActive ?? product.isActive) ? "Aktivan" : "Neaktivan"}
                    </button>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          setSavingId(product.id)
                          setErrorId(null)
                          const priceValue = Number(drafts[product.id]?.price ?? product.price)
                          const isActive = drafts[product.id]?.isActive ?? product.isActive
                          const result = await updateProductInline(product.id, {
                            price: priceValue,
                            isActive,
                          })
                          if (result?.error) {
                            setErrorId(product.id)
                            toast.error("Greška", result.error)
                          } else {
                            toast.success("Ažurirano", "Proizvod ažuriran")
                            setDrafts((prev) => {
                              const next = { ...prev }
                              delete next[product.id]
                              return next
                            })
                          }
                          setSavingId(null)
                        }}
                        disabled={savingId === product.id}
                        aria-label={
                          savingId === product.id
                            ? `Spremanje promjena za ${product.name}`
                            : errorId === product.id
                              ? `Greška pri spremanju ${product.name}`
                              : `Spremi promjene za ${product.name}`
                        }
                      >
                        {savingId === product.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : errorId === product.id ? (
                          <XCircle className="h-4 w-4 text-danger" />
                        ) : (
                          <Check className="h-4 w-4 text-success-text" />
                        )}
                      </Button>
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
