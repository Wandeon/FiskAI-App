"use client"

import { useState } from "react"
import { submitContactForm } from "@/app/actions/marketing-contact"
import type { MarketingContactInput } from "@/lib/validations/marketing-contact"

export function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null
    message: string
  }>({ type: null, message: "" })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus({ type: null, message: "" })
    setFieldErrors({})

    const formData = new FormData(e.currentTarget)
    const data: MarketingContactInput = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      businessType: formData.get("businessType") as MarketingContactInput["businessType"],
      invoiceVolume: formData.get("invoiceVolume") as MarketingContactInput["invoiceVolume"],
      message: formData.get("message") as string,
    }

    try {
      const result = await submitContactForm(data)

      if (result.success) {
        setSubmitStatus({
          type: "success",
          message: result.message || "Uspješno poslano!",
        })
        // Reset form
        e.currentTarget.reset()
      } else {
        setSubmitStatus({
          type: "error",
          message: result.error || "Došlo je do greške",
        })
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors)
        }
      }
    } catch (error) {
      setSubmitStatus({
        type: "error",
        message: "Došlo je do neočekivane greške. Molimo pokušajte ponovno.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Ime i prezime *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          disabled={isSubmitting}
          className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="Vaše ime i prezime"
        />
        {fieldErrors.name && (
          <p className="mt-1 text-xs text-danger-text">{fieldErrors.name[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email *
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          disabled={isSubmitting}
          className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="vaš@email.hr"
        />
        {fieldErrors.email && (
          <p className="mt-1 text-xs text-danger-text">{fieldErrors.email[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="businessType" className="block text-sm font-medium mb-1">
          Tip poslovanja *
        </label>
        <select
          id="businessType"
          name="businessType"
          required
          disabled={isSubmitting}
          className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Odaberite...</option>
          <option value="pausalni-obrt">Paušalni obrt</option>
          <option value="vat-obrt">VAT obrt</option>
          <option value="doo">d.o.o.</option>
          <option value="accountant">Knjigovođa/računovoda</option>
        </select>
        {fieldErrors.businessType && (
          <p className="mt-1 text-xs text-danger-text">{fieldErrors.businessType[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="invoiceVolume" className="block text-sm font-medium mb-1">
          Broj računa mjesečno *
        </label>
        <select
          id="invoiceVolume"
          name="invoiceVolume"
          required
          disabled={isSubmitting}
          className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Odaberite...</option>
          <option value="1-10">1-10</option>
          <option value="11-50">11-50</option>
          <option value="51-200">51-200</option>
          <option value="200+">200+</option>
        </select>
        {fieldErrors.invoiceVolume && (
          <p className="mt-1 text-xs text-danger-text">{fieldErrors.invoiceVolume[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium mb-1">
          Poruka (opcionalno)
        </label>
        <textarea
          id="message"
          name="message"
          disabled={isSubmitting}
          className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 min-h-[100px] disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="Specifična pitanja ili zahtjevi..."
        />
        {fieldErrors.message && (
          <p className="mt-1 text-xs text-danger-text">{fieldErrors.message[0]}</p>
        )}
      </div>

      {submitStatus.type && (
        <div
          className={`rounded-md p-3 text-sm ${
            submitStatus.type === "success"
              ? "bg-success-bg text-success-text border border-success-border"
              : "bg-danger-bg text-danger-text border border-danger-border"
          }`}
        >
          {submitStatus.message}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-interactive px-4 py-3 text-sm font-semibold text-white hover:bg-interactive-hover disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {isSubmitting ? "Šaljem..." : "Pošalji zahtjev za demo"}
      </button>

      <p className="text-xs text-white/60">
        Kontaktirat ćemo vas unutar 24h radnim danima da dogovorimo vrijeme demo sastanka.
      </p>
    </form>
  )
}
