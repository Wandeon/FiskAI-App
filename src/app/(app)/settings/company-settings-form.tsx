"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { companySchema } from "@/lib/validations"
import { updateCompany } from "@/app/actions/company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Company } from "@prisma/client"
import { toast } from "@/lib/toast"

type CompanyFormInput = z.input<typeof companySchema>

interface CompanySettingsFormProps {
  company: Company
}

export function CompanySettingsForm({ company }: CompanySettingsFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanyFormInput>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: company.name,
      oib: company.oib,
      vatNumber: company.vatNumber || "",
      address: company.address,
      city: company.city,
      postalCode: company.postalCode,
      country: company.country,
      email: company.email || "",
      phone: company.phone || "",
      iban: company.iban || "",
      isVatPayer: company.isVatPayer,
    },
  })

  async function onSubmit(data: CompanyFormInput) {
    setLoading(true)
    setError(null)
    setSuccess(null)

    const result = await updateCompany(company.id, data)

    if (result?.error) {
      setError(result.error)
      toast.error("Greška", result.error)
      setLoading(false)
      return
    }

    setSuccess("Podaci uspješno ažurirani")
    toast.success("Postavke spremljene")
    setLoading(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && <div className="rounded-md bg-danger-bg border border-danger-border p-3 text-sm text-danger-text">{error}</div>}
      {success && (
        <div className="rounded-md bg-success-bg border border-success-border p-3 text-sm text-success-text">{success}</div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Naziv tvrtke *</label>
          <Input {...register("name")} error={errors.name?.message} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">OIB *</label>
          <Input {...register("oib")} error={errors.oib?.message} disabled className="bg-surface-1" />
          <p className="text-xs text-secondary">OIB se ne može mijenjati nakon kreiranja tvrtke</p>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium">Adresa *</label>
          <Input {...register("address")} error={errors.address?.message} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Poštanski broj *</label>
          <Input {...register("postalCode")} error={errors.postalCode?.message} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Grad *</label>
          <Input {...register("city")} error={errors.city?.message} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Email</label>
          <Input type="email" {...register("email")} error={errors.email?.message} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Telefon</label>
          <Input {...register("phone")} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">IBAN</label>
          <Input {...register("iban")} placeholder="HR1234567890123456789" />
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300"
              {...register("isVatPayer")}
            />
            <span className="text-sm font-medium">PDV obveznik</span>
          </label>
        </div>
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? "Spremanje..." : "Spremi promjene"}
      </Button>
    </form>
  )
}
