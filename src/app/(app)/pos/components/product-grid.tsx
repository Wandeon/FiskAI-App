"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CustomItemModal } from "./custom-item-modal"
import type { PosProduct } from "../types"

interface Props {
  products: PosProduct[]
  onProductClick: (product: PosProduct) => void
  onCustomItem: (item: { description: string; unitPrice: number; vatRate: number }) => void
}

export function ProductGrid({ products, onProductClick, onCustomItem }: Props) {
  const [search, setSearch] = useState("")
  const [showCustomModal, setShowCustomModal] = useState(false)

  const filtered = useMemo(() => {
    if (!search.trim()) return products
    const q = search.toLowerCase()
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
    )
  }, [products, search])

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("hr-HR", {
      style: "currency",
      currency: "EUR",
    }).format(price)

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-2">
        <Input
          type="search"
          placeholder="Pretraži proizvode..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Button variant="outline" onClick={() => setShowCustomModal(true)}>
          + Prilagođena stavka
        </Button>
      </div>

      {/* Product Grid */}
      {filtered.length === 0 ? (
        <div className="text-center text-[var(--muted)] py-12">
          {search ? "Nema rezultata" : "Nema proizvoda"}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((product) => (
            <button
              key={product.id}
              onClick={() => onProductClick(product)}
              className="p-4 bg-[var(--surface)] rounded-lg border border-[var(--border)] hover:border-interactive hover:shadow-md transition-all text-left"
            >
              <div className="font-medium truncate">{product.name}</div>
              {product.sku && <div className="text-xs text-[var(--muted)]">{product.sku}</div>}
              <div className="mt-2 text-lg font-bold text-link">{formatPrice(product.price)}</div>
              <div className="text-xs text-[var(--muted)]">PDV {product.vatRate}%</div>
            </button>
          ))}
        </div>
      )}

      {/* Custom Item Modal */}
      {showCustomModal && (
        <CustomItemModal
          onClose={() => setShowCustomModal(false)}
          onAdd={(item) => {
            onCustomItem(item)
            setShowCustomModal(false)
          }}
        />
      )}
    </div>
  )
}
