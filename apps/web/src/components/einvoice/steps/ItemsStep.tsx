"use client"

import { useState, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, ChevronLeft, ChevronRight, Search, Package, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { trpc } from "@/trpc/client"
import { LineItemRow } from "../LineItemRow"
import { UNIT_CODES, type EInvoiceLineInput } from "@fiskai/shared"

// Product type matching Prisma Product model
// price is stored as Decimal in DB but comes through tRPC as number-like
type ProductFromDb = {
  id: string
  name: string
  sku: string | null
  description: string | null
  unit: string
  price: { toNumber(): number } | number
  vatRate: number
  vatCategory: string
}

interface ItemsStepProps {
  companyId: string
  lines: EInvoiceLineInput[]
  onLinesChange: (lines: EInvoiceLineInput[]) => void
  onNext: () => void
  onBack: () => void
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("hr-HR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + " EUR"

const getDefaultLine = (): EInvoiceLineInput => ({
  description: "",
  quantity: 1,
  unit: "C62",
  unitPrice: 0,
  vatRate: 25,
  vatCategory: "S",
})

export function ItemsStep({
  companyId,
  lines,
  onLinesChange,
  onNext,
  onBack,
}: ItemsStepProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [showProductSearch, setShowProductSearch] = useState(false)

  // Fetch products via tRPC
  const { data: products, isLoading: isLoadingProducts } = trpc.eInvoice.getProducts.useQuery(
    { companyId, search: searchQuery || undefined },
    { enabled: showProductSearch }
  )

  // Filter products based on search
  const filteredProducts = useMemo(() => {
    if (!products || !searchQuery.trim()) return products || []
    const q = searchQuery.toLowerCase()
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      )
      .slice(0, 6)
  }, [products, searchQuery])

  // Calculate totals
  const totals = useMemo(() => {
    let neto = 0
    let pdv = 0
    lines.forEach((line) => {
      const lineNeto = line.quantity * line.unitPrice
      const lineVat = lineNeto * (line.vatRate / 100)
      neto += lineNeto
      pdv += lineVat
    })
    return {
      neto,
      pdv,
      ukupno: neto + pdv,
    }
  }, [lines])

  // Line management
  const handleAddLine = useCallback(() => {
    onLinesChange([...lines, getDefaultLine()])
  }, [lines, onLinesChange])

  const handleUpdateLine = useCallback(
    (index: number, updates: Partial<EInvoiceLineInput>) => {
      const newLines = [...lines]
      newLines[index] = { ...newLines[index], ...updates } as EInvoiceLineInput
      onLinesChange(newLines)
    },
    [lines, onLinesChange]
  )

  const handleDeleteLine = useCallback(
    (index: number) => {
      const newLines = lines.filter((_, i) => i !== index)
      onLinesChange(newLines)
    },
    [lines, onLinesChange]
  )

  const handleAddFromProduct = useCallback(
    (product: ProductFromDb) => {
      // Convert price from Decimal/number (cents) to EUR number
      const rawPrice = typeof product.price === "number" ? product.price : product.price.toNumber()
      const priceInEur = rawPrice / 100
      // Map vatCategory to valid type, default to "S" if unknown
      const vatCategoryMap: Record<string, "S" | "AA" | "E" | "Z" | "O"> = {
        S: "S",
        AA: "AA",
        E: "E",
        Z: "Z",
        O: "O",
      }
      const vatCategory = vatCategoryMap[product.vatCategory] || "S"

      const newLine: EInvoiceLineInput = {
        description: product.name,
        quantity: 1,
        unit: product.unit || "C62",
        unitPrice: priceInEur,
        vatRate: product.vatRate,
        vatCategory,
        productId: product.id,
      }
      onLinesChange([...lines, newLine])
      setShowProductSearch(false)
      setSearchQuery("")
    },
    [lines, onLinesChange]
  )

  // Validation
  const isValid = lines.length > 0 && lines.every((line) => line.description.trim() !== "")

  const inputClasses = cn(
    "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white",
    "placeholder:text-white/30",
    "focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20",
    "transition-colors"
  )

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Stavke racuna</h1>
        <p className="mt-2 text-white/60">Dodajte stavke na racun</p>
      </div>

      {/* Product Search (collapsible) */}
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Dodaj iz kataloga</h2>
          <button
            type="button"
            onClick={() => setShowProductSearch(!showProductSearch)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm transition-colors",
              showProductSearch
                ? "bg-cyan-500/20 text-cyan-400"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            )}
          >
            {showProductSearch ? "Zatvori" : "Pretrazi katalog"}
          </button>
        </div>

        <AnimatePresence>
          {showProductSearch && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              {/* Search Input */}
              <div className="relative mb-4">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pretrazite proizvode po nazivu, sifri..."
                  className={cn(inputClasses, "pl-12")}
                  autoFocus
                />
              </div>

              {/* Products List */}
              <div className="max-h-64 overflow-y-auto space-y-2">
                {isLoadingProducts ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                    <span className="ml-2 text-white/60">Ucitavanje...</span>
                  </div>
                ) : filteredProducts && filteredProducts.length > 0 ? (
                  filteredProducts.map((product) => (
                    <motion.button
                      key={product.id}
                      type="button"
                      onClick={() => handleAddFromProduct(product)}
                      className={cn(
                        "w-full flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4 text-left transition-all",
                        "hover:border-cyan-500/50 hover:bg-cyan-500/10"
                      )}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                        <Package className="h-5 w-5 text-white/40" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{product.name}</p>
                        <div className="flex items-center gap-2 text-sm text-white/60">
                          <span>{formatCurrency((typeof product.price === "number" ? product.price : product.price.toNumber()) / 100)}</span>
                          <span>|</span>
                          <span>{UNIT_CODES[product.unit as keyof typeof UNIT_CODES] || "kom"}</span>
                          <span>|</span>
                          <span>PDV {product.vatRate}%</span>
                        </div>
                      </div>
                      <Plus className="h-5 w-5 text-cyan-400" />
                    </motion.button>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Package className="h-10 w-10 text-white/20 mb-2" />
                    <p className="text-white/60">
                      {searchQuery ? "Nema rezultata pretrage" : "Nemate proizvoda u katalogu"}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Line Items */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Stavke <span className="text-cyan-400">*</span>
          </h2>
          <span className="text-sm text-white/40">{lines.length} stavki</span>
        </div>

        {/* Lines List */}
        <AnimatePresence mode="popLayout">
          {lines.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-8 text-center"
            >
              <AlertCircle className="h-10 w-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/60">Nema stavki na racunu</p>
              <p className="text-sm text-white/40 mt-1">
                Dodajte stavke iz kataloga ili rucno
              </p>
            </motion.div>
          ) : (
            lines.map((line, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                layout
              >
                <LineItemRow
                  line={line}
                  index={index}
                  onUpdate={handleUpdateLine}
                  onDelete={handleDeleteLine}
                  canDelete={lines.length > 0}
                />
              </motion.div>
            ))
          )}
        </AnimatePresence>

        {/* Add Line Button */}
        <motion.button
          type="button"
          onClick={handleAddLine}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 py-4",
            "text-white/60 hover:border-cyan-500/50 hover:text-cyan-400 hover:bg-cyan-500/5",
            "transition-all"
          )}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <Plus className="h-5 w-5" />
          Dodaj stavku
        </motion.button>
      </div>

      {/* Totals */}
      {lines.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Ukupno</h2>
          <div className="space-y-2 font-mono">
            <div className="flex items-center justify-between text-white/60">
              <span>Neto:</span>
              <span className="tabular-nums">{formatCurrency(totals.neto)}</span>
            </div>
            <div className="flex items-center justify-between text-white/60">
              <span>PDV:</span>
              <span className="tabular-nums">{formatCurrency(totals.pdv)}</span>
            </div>
            <div className="border-t border-white/10 pt-2 mt-2">
              <div className="flex items-center justify-between text-lg font-bold text-white">
                <span>Ukupno:</span>
                <span className="tabular-nums text-cyan-400">{formatCurrency(totals.ukupno)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Validation Message */}
      {!isValid && lines.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-amber-400">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm">Sve stavke moraju imati opis</span>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex gap-4">
        <motion.button
          type="button"
          onClick={onBack}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl py-4 font-semibold transition-all",
            "border border-white/10 bg-white/5 text-white hover:bg-white/10"
          )}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <ChevronLeft className="h-5 w-5" />
          Natrag
        </motion.button>
        <motion.button
          type="button"
          onClick={onNext}
          disabled={!isValid}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl py-4 font-semibold transition-all",
            isValid
              ? "bg-cyan-500 text-white hover:bg-cyan-400"
              : "cursor-not-allowed bg-white/10 text-white/40"
          )}
          whileHover={isValid ? { scale: 1.02 } : {}}
          whileTap={isValid ? { scale: 0.98 } : {}}
        >
          Dalje
          <ChevronRight className="h-5 w-5" />
        </motion.button>
      </div>
    </motion.div>
  )
}

export default ItemsStep
