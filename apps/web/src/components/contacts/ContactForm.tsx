"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { createContact, updateContact, type ContactInput } from "@/app/(app)/contacts/actions"

interface ContactFormProps {
  initialData?: ContactInput & { id: string }
  mode: "create" | "edit"
}

const contactTypes = [
  { value: "CUSTOMER", label: "Kupac" },
  { value: "SUPPLIER", label: "Dobavljac" },
  { value: "BOTH", label: "Oba" },
] as const

const defaultFormData: ContactInput = {
  type: "CUSTOMER",
  name: "",
  oib: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  zipCode: "",
  country: "HR",
}

export function ContactForm({ initialData, mode }: ContactFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<ContactInput>(() => {
    if (initialData) {
      return {
        type: initialData.type,
        name: initialData.name,
        oib: initialData.oib || "",
        email: initialData.email || "",
        phone: initialData.phone || "",
        address: initialData.address || "",
        city: initialData.city || "",
        zipCode: initialData.zipCode || "",
        country: initialData.country || "HR",
      }
    }
    return defaultFormData
  })

  const handleChange = (field: keyof ContactInput, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (error) setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const result =
        mode === "create"
          ? await createContact(formData)
          : await updateContact(initialData!.id, formData)

      if (result.success) {
        router.push("/contacts")
      } else {
        setError(result.error || "Doslo je do greske")
      }
    } catch {
      setError("Doslo je do greske pri spremanju kontakta")
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

  const labelClasses = "block text-sm font-medium text-white/70 mb-2"

  return (
    <div className="p-6 lg:p-8">
      <div className="mx-auto max-w-2xl">
        {/* Back Link */}
        <Link
          href="/contacts"
          className="mb-6 inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Natrag na kontakte
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-white">
            {mode === "create" ? "Novi kontakt" : "Uredi kontakt"}
          </h1>
          <p className="mt-2 text-white/60">
            {mode === "create"
              ? "Dodajte novog kupca ili dobavljaca"
              : "Azurirajte podatke kontakta"}
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

            {/* Type Selector */}
            <div>
              <label className={labelClasses}>
                Tip kontakta <span className="text-cyan-400">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {contactTypes.map((type) => {
                  const isActive = formData.type === type.value
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => handleChange("type", type.value)}
                      className={cn(
                        "rounded-xl border px-4 py-2 text-sm font-medium transition-all",
                        isActive
                          ? "border-cyan-500/30 bg-cyan-500/20 text-cyan-400"
                          : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      {type.label}
                    </button>
                  )
                })}
              </div>
            </div>

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
                placeholder="Naziv tvrtke ili ime osobe"
                className={inputClasses}
                required
              />
            </div>

            {/* OIB */}
            <div>
              <label htmlFor="oib" className={labelClasses}>
                OIB
              </label>
              <input
                id="oib"
                type="text"
                value={formData.oib}
                onChange={(e) => handleChange("oib", e.target.value)}
                placeholder="12345678901"
                maxLength={11}
                className={inputClasses}
              />
              <p className="mt-1 text-xs text-white/40">
                11-znamenkasti OIB (opcionalno za strane kontakte)
              </p>
            </div>

            {/* Email & Phone Row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className={labelClasses}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="kontakt@email.hr"
                  className={inputClasses}
                />
              </div>
              <div>
                <label htmlFor="phone" className={labelClasses}>
                  Telefon
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="+385 91 234 5678"
                  className={inputClasses}
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label htmlFor="address" className={labelClasses}>
                Adresa
              </label>
              <input
                id="address"
                type="text"
                value={formData.address}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="Ulica i broj"
                className={inputClasses}
              />
            </div>

            {/* City & Zip Row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="zipCode" className={labelClasses}>
                  Postanski broj
                </label>
                <input
                  id="zipCode"
                  type="text"
                  value={formData.zipCode}
                  onChange={(e) => handleChange("zipCode", e.target.value)}
                  placeholder="10000"
                  className={inputClasses}
                />
              </div>
              <div>
                <label htmlFor="city" className={labelClasses}>
                  Grad
                </label>
                <input
                  id="city"
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleChange("city", e.target.value)}
                  placeholder="Zagreb"
                  className={inputClasses}
                />
              </div>
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
                  "Stvori kontakt"
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
