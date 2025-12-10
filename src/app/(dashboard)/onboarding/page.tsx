"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { companySchema, CompanyInput } from "@/lib/validations"
import { createCompany } from "@/app/actions/company"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export default function OnboardingPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanyInput>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      country: "HR",
      isVatPayer: false,
    },
  })

  async function onSubmit(data: CompanyInput) {
    setLoading(true)
    setError(null)

    const result = await createCompany(data)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Dobrodošli u FiskAI</h1>
        <p className="text-gray-600">
          Postavite svoju tvrtku za početak korištenja
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Podaci o tvrtki</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Naziv tvrtke</label>
              <Input
                {...register("name")}
                error={errors.name?.message}
                placeholder="Moja Tvrtka d.o.o."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">OIB</label>
              <Input
                {...register("oib")}
                error={errors.oib?.message}
                placeholder="12345678901"
                maxLength={11}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Adresa</label>
              <Input
                {...register("address")}
                error={errors.address?.message}
                placeholder="Ilica 1"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Grad</label>
                <Input
                  {...register("city")}
                  error={errors.city?.message}
                  placeholder="Zagreb"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Poštanski broj</label>
                <Input
                  {...register("postalCode")}
                  error={errors.postalCode?.message}
                  placeholder="10000"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  {...register("email")}
                  placeholder="info@tvrtka.hr"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Telefon</label>
                <Input {...register("phone")} placeholder="+385 1 234 5678" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">IBAN</label>
              <Input
                {...register("iban")}
                placeholder="HR1234567890123456789"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isVatPayer"
                {...register("isVatPayer")}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="isVatPayer" className="text-sm">
                Obveznik PDV-a
              </label>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Spremanje..." : "Nastavi"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
