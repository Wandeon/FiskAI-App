"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Search, X, Edit2, Trash2, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { updateProductInline, deleteProduct } from "@/app/(app)/products/actions"

const UNIT_LABELS: Record<string, string> = {
  PCE: "Komad",
  HUR: "Sat",
  DAY: "Dan",
  MON: "Mjesec",
  KGM: "Kilogram",
  MTR: "Metar",
  LTR: "Litra",
}

const STATUS_FILTERS = [
  { value: "ALL", label: "Svi" },
  { value: "ACTIVE", label: "Aktivni" },
  { value: "INACTIVE", label: "Neaktivni" },
] as const

interface Product {
  id: string
  name: string
  description: string | null
  sku: string | null
  price: number
  unit: string
  vatRate: number
  vatCategory: string
  isActive: boolean
}

interface ProductTableProps {
  products: Product[]
  search: string
  status: "ALL" | "ACTIVE" | "INACTIVE"
}

export function ProductTable({ products, search, status }: ProductTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState<string>("")
  const [savingId, setSavingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const updateSearch = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set("search", value)
    } else {
      params.delete("search")
    }
    startTransition(() => {
      router.push(`/products?${params.toString()}`)
    })
  }

  const clearSearch = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("search")
    startTransition(() => {
      router.push(`/products?${params.toString()}`)
    })
  }

  const updateStatus = (newStatus: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (newStatus !== "ALL") {
      params.set("status", newStatus)
    } else {
      params.delete("status")
    }
    startTransition(() => {
      router.push(`/products?${params.toString()}`)
    })
  }

  const startEditing = (product: Product) => {
    setEditingId(product.id)
    setEditPrice(product.price.toFixed(2))
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditPrice("")
  }

  const savePrice = async (productId: string) => {
    const price = parseFloat(editPrice)
    if (isNaN(price) || price < 0) {
      return
    }

    setSavingId(productId)
    const result = await updateProductInline(productId, { price })
    setSavingId(null)

    if (result.success) {
      setEditingId(null)
      setEditPrice("")
      router.refresh()
    }
  }

  const toggleStatus = async (product: Product) => {
    setTogglingId(product.id)
    const result = await updateProductInline(product.id, { isActive: !product.isActive })
    setTogglingId(null)

    if (result.success) {
      router.refresh()
    }
  }

  const handleDelete = async (productId: string) => {
    if (!confirm("Jeste li sigurni da zelite obrisati ovaj proizvod?")) {
      return
    }

    setDeletingId(productId)
    const result = await deleteProduct(productId)
    setDeletingId(null)

    if (result.success) {
      router.refresh()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, productId: string) => {
    if (e.key === "Enter") {
      savePrice(productId)
    } else if (e.key === "Escape") {
      cancelEditing()
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Status Filter Buttons */}
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {STATUS_FILTERS.map((filter) => {
            const isActive = status === filter.value
            return (
              <button
                key={filter.value}
                onClick={() => updateStatus(filter.value)}
                className={cn(
                  "flex-shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                  isActive
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                    : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white"
                )}
              >
                {filter.label}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Pretrazi proizvode..."
            defaultValue={search}
            onChange={(e) => updateSearch(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-10 text-sm text-white placeholder:text-white/40 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-colors"
          />
          {search && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {isPending && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-white/50">
                Naziv
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-white/50">
                Sifra
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-white/50">
                Cijena (EUR)
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-white/50">
                Jedinica
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase text-white/50">
                PDV
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase text-white/50">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-white/50">
                Akcije
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr
                key={product.id}
                className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
              >
                {/* Naziv */}
                <td className="px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate max-w-[200px]">
                      {product.name}
                    </p>
                    {product.description && (
                      <p className="text-sm text-white/50 truncate max-w-[200px]">
                        {product.description}
                      </p>
                    )}
                  </div>
                </td>

                {/* Sifra */}
                <td className="px-4 py-3">
                  <span className="font-mono text-sm text-white/70">
                    {product.sku || "-"}
                  </span>
                </td>

                {/* Cijena */}
                <td className="px-4 py-3 text-right">
                  {editingId === product.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, product.id)}
                        autoFocus
                        className="w-24 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-right text-sm text-white focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                      />
                      <button
                        onClick={() => savePrice(product.id)}
                        disabled={savingId === product.id}
                        className="rounded-lg p-1.5 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                      >
                        {savingId === product.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditing(product)}
                      className="font-mono text-sm text-white hover:text-cyan-400 transition-colors"
                    >
                      {product.price.toFixed(2)}
                    </button>
                  )}
                </td>

                {/* Jedinica */}
                <td className="px-4 py-3">
                  <span className="text-sm text-white/70">
                    {UNIT_LABELS[product.unit] || product.unit}
                  </span>
                </td>

                {/* PDV */}
                <td className="px-4 py-3 text-center">
                  <span className="text-sm text-white/70">{product.vatRate}%</span>
                </td>

                {/* Status */}
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleStatus(product)}
                    disabled={togglingId === product.id}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all",
                      product.isActive
                        ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                        : "bg-red-500/20 text-red-400 hover:bg-red-500/30",
                      togglingId === product.id && "opacity-50"
                    )}
                  >
                    {togglingId === product.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : null}
                    {product.isActive ? "Aktivan" : "Neaktivan"}
                  </button>
                </td>

                {/* Akcije */}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/products/${product.id}/edit`}
                      className="rounded-lg p-2 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(product.id)}
                      disabled={deletingId === product.id}
                      className="rounded-lg p-2 text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      {deletingId === product.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
