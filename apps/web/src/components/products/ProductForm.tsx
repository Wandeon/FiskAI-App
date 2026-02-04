"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { createProduct, updateProduct, type ProductInput } from "@/app/(app)/products/actions"

interface ProductFormProps {
  initialData?: ProductInput & { id: string }
  mode: "create" | "edit"
}

const unitOptions = [
  { value: "PCE", label: "Komad" },
  { value: "HUR", label: "Sat" },
  { value: "DAY", label: "Dan" },
  { value: "MON", label: "Mjesec" },
  { value: "KGM", label: "Kilogram" },
  { value: "MTR", label: "Metar" },
  { value: "LTR", label: "Litra" },
] as const

const vatOptions = [
  { value: 25, label: "25% - Standardna stopa", category: "S" },
  { value: 13, label: "13% - Snizena stopa", category: "R" },
  { value: 5, label: "5% - Super snizena stopa", category: "AA" },
  { value: 0, label: "0% - Nulta stopa", category: "Z" },
] as const

const defaultFormData: ProductInput = {
  name: "",
  description: "",
  sku: "",
  price: 0,
  unit: "PCE",
  vatRate: 25,
  vatCategory: "S",
  isActive: true,
}

export function ProductForm({ initialData, mode }: ProductFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<ProductInput>(() => {
    if (initialData) {
      return {
        name: initialData.name,
        description: initialData.description || "",
        sku: initialData.sku || "",
        price: initialData.price,
        unit: initialData.unit,
        vatRate: initialData.vatRate,
        vatCategory: initialData.vatCategory,
        isActive: initialData.isActive,
      }
    }
    return defaultFormData
  })

  const handleChange = <K extends keyof ProductInput>(field: K, value: ProductInput[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (error) setError(null)
  }

  const handleVatChange = (vatRate: number) => {
    const vatOption = vatOptions.find((opt) => opt.value === vatRate)
    setFormData((prev) => ({
      ...prev,
      vatRate,
      vatCategory: vatOption?.category || "S",
    }))
    if (error) setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result =
        mode === "create"
          ? await createProduct(formData)
          : await updateProduct(initialData!.id, formData)

      if (result.success) {
        router.push("/products")
      } else {
        setError(result.error || "Doslo je do greske")
      }
    } catch {
      setError("Doslo je do greske pri spremanju proizvoda")
    } finally {
      setIsLoading(false)
    }
  }

  const inputClasses = cn(
    "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white",
    "placeholder:text-white/30",
    "focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20",
    "transition-colors"
  )

  const selectClasses = cn(
    "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white",
    "focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/20",
    "transition-colors appearance-none cursor-pointer",
    "[&>option]:bg-slate-900 [&>option]:text-white"
  )

  const labelClasses = "block text-sm font-medium text-white/70 mb-2"

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-2xl">
        {/* Back Link */}
        <Link
          href="/products"
          className="mb-6 inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Natrag na proizvode
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-white">
            {mode === "create" ? "Novi proizvod" : "Uredi proizvod"}
          </h1>
          <p className="mt-2 text-white/60">
            {mode === "create"
              ? "Dodajte novi proizvod ili uslugu"
              : "Azurirajte podatke proizvoda"}
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Display */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4"
                >
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-400" />
                  <p className="text-sm text-red-400">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Name */}
            <div>
              <label htmlFor="name" className={labelClasses}>
                Naziv <span className="text-cyan-400">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Naziv proizvoda ili usluge"
                className={inputClasses}
                required
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className={labelClasses}>
                Opis
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Kratki opis proizvoda"
                rows={3}
                className={cn(inputClasses, "resize-none")}
              />
            </div>

            {/* SKU */}
            <div>
              <label htmlFor="sku" className={labelClasses}>
                Sifra proizvoda (SKU)
              </label>
              <input
                id="sku"
                type="text"
                value={formData.sku}
                onChange={(e) => handleChange("sku", e.target.value)}
                placeholder="ABC-123"
                className={inputClasses}
              />
            </div>

            {/* Price & Unit Row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="price" className={labelClasses}>
                  Cijena (EUR) <span className="text-cyan-400">*</span>
                </label>
                <input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => handleChange("price", parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className={inputClasses}
                  required
                />
              </div>
              <div>
                <label htmlFor="unit" className={labelClasses}>
                  Mjerna jedinica
                </label>
                <select
                  id="unit"
                  value={formData.unit}
                  onChange={(e) => handleChange("unit", e.target.value)}
                  className={selectClasses}
                >
                  {unitOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* VAT Rate */}
            <div>
              <label htmlFor="vatRate" className={labelClasses}>
                Stopa PDV-a
              </label>
              <select
                id="vatRate"
                value={formData.vatRate}
                onChange={(e) => handleVatChange(parseInt(e.target.value, 10))}
                className={selectClasses}
              >
                {vatOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-white/40">
                Kategorija PDV-a: {formData.vatCategory}
              </p>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
              <div>
                <p className="font-medium text-white">Aktivan proizvod</p>
                <p className="text-sm text-white/50">
                  Neaktivni proizvodi nece biti prikazani prilikom izrade racuna
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={formData.isActive}
                onClick={() => handleChange("isActive", !formData.isActive)}
                className={cn(
                  "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-slate-900",
                  formData.isActive ? "bg-cyan-500" : "bg-white/20"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    formData.isActive ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isLoading || !formData.name.trim()}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold transition-all",
                  isLoading || !formData.name.trim()
                    ? "cursor-not-allowed bg-white/10 text-white/40"
                    : "bg-cyan-500 text-white hover:bg-cyan-400"
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {mode === "create" ? "Stvaranje..." : "Spremanje..."}
                  </>
                ) : mode === "create" ? (
                  "Stvori proizvod"
                ) : (
                  "Spremi promjene"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
