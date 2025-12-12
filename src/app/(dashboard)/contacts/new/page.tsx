"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { contactSchema } from "@/lib/validations"
import { createContact } from "@/app/actions/contact"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { OibInput } from "@/components/ui/oib-input"
import { toast } from "@/lib/toast"

type ContactFormInput = z.input<typeof contactSchema>

// EU country codes for VAT lookup
const EU_COUNTRIES = [
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "EL", "ES", "FI", "FR",
  "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO",
  "SE", "SI", "SK"
]

export default function NewContactPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ContactFormInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      type: "CUSTOMER",
      country: "HR",
    },
  })

  const oibValue = watch("oib") || ""
  const countryValue = watch("country") || "HR"
  const isLocalCustomer = countryValue === "HR"
  const isEuCustomer = EU_COUNTRIES.includes(countryValue) && countryValue !== "HR"

  async function onSubmit(data: ContactFormInput) {
    setLoading(true)
    setError(null)

    const result = await createContact({
      ...data,
      country: data.country || "HR",
    })

    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.push("/contacts")
  }

  function handleOibLookupSuccess(data: {
    name?: string
    address?: string
    city?: string
    postalCode?: string
    vatNumber?: string
  }) {
    // Auto-fill form fields with looked up data
    if (data.name) setValue("name", data.name)
    if (data.address) setValue("address", data.address)
    if (data.city) setValue("city", data.city)
    if (data.postalCode) setValue("postalCode", data.postalCode)
    if (data.vatNumber) setValue("vatNumber", data.vatNumber)
    
    toast.success("Pronađeno!", "Podaci o tvrtki su automatski popunjeni")
  }

  function handleOibLookupError(errorMsg: string) {
    toast.error("Nije pronađeno", errorMsg)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Novi kontakt</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Osnovni podaci</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Vrsta kontakta</label>
              <select
                className="h-10 w-full rounded-md border border-gray-300 px-3"
                {...register("type")}
              >
                <option value="CUSTOMER">Kupac</option>
                <option value="SUPPLIER">Dobavljač</option>
                <option value="BOTH">Kupac i dobavljač</option>
              </select>
              {errors.type && (
                <p className="text-sm text-red-500">{errors.type.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Država</label>
              <select
                className="h-10 w-full rounded-md border border-gray-300 px-3"
                {...register("country")}
              >
                <option value="HR">🇭🇷 Hrvatska</option>
                <optgroup label="EU zemlje">
                  <option value="AT">🇦🇹 Austrija</option>
                  <option value="BE">🇧🇪 Belgija</option>
                  <option value="BG">🇧🇬 Bugarska</option>
                  <option value="CY">🇨🇾 Cipar</option>
                  <option value="CZ">🇨🇿 Češka</option>
                  <option value="DE">🇩🇪 Njemačka</option>
                  <option value="DK">🇩🇰 Danska</option>
                  <option value="EE">🇪🇪 Estonija</option>
                  <option value="EL">🇬🇷 Grčka</option>
                  <option value="ES">🇪🇸 Španjolska</option>
                  <option value="FI">🇫🇮 Finska</option>
                  <option value="FR">🇫🇷 Francuska</option>
                  <option value="HU">🇭🇺 Mađarska</option>
                  <option value="IE">🇮🇪 Irska</option>
                  <option value="IT">🇮🇹 Italija</option>
                  <option value="LT">🇱🇹 Litva</option>
                  <option value="LU">🇱🇺 Luksemburg</option>
                  <option value="LV">🇱🇻 Latvija</option>
                  <option value="MT">🇲🇹 Malta</option>
                  <option value="NL">🇳🇱 Nizozemska</option>
                  <option value="PL">🇵🇱 Poljska</option>
                  <option value="PT">🇵🇹 Portugal</option>
                  <option value="RO">🇷🇴 Rumunjska</option>
                  <option value="SE">🇸🇪 Švedska</option>
                  <option value="SI">🇸🇮 Slovenija</option>
                  <option value="SK">🇸🇰 Slovačka</option>
                </optgroup>
                <optgroup label="Ostale zemlje">
                  <option value="OTHER">Ostalo (izvan EU)</option>
                </optgroup>
              </select>
            </div>

            {isLocalCustomer ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">OIB</label>
                <OibInput
                  value={oibValue}
                  onChange={(value) => setValue("oib", value)}
                  onLookupSuccess={handleOibLookupSuccess}
                  onLookupError={handleOibLookupError}
                  error={errors.oib?.message}
                />
                <p className="text-xs text-gray-500">
                  11 znamenaka - automatski pronalazi podatke tvrtke
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {isEuCustomer ? "PDV ID (VAT)" : "Porezni broj"}
                </label>
                <Input
                  {...register("vatNumber")}
                  placeholder={isEuCustomer ? `${countryValue}123456789` : "Porezni identifikacijski broj"}
                />
                {isEuCustomer && (
                  <p className="text-xs text-gray-500">
                    EU PDV identifikacijski broj (npr. {countryValue}123456789)
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Naziv *</label>
              <Input
                {...register("name")}
                placeholder="Naziv tvrtke ili ime osobe"
                error={errors.name?.message}
              />
            </div>

            {isLocalCustomer && (
              <div className="space-y-2">
                <label className="text-sm font-medium">PDV ID</label>
                <Input
                  {...register("vatNumber")}
                  placeholder="HR12345678901"
                  disabled
                />
                <p className="text-xs text-gray-500">
                  Automatski popunjeno iz OIB-a (HR + OIB)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Adresa</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Ulica i broj</label>
              <Input
                {...register("address")}
                placeholder="Ulica i kućni broj"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Poštanski broj</label>
              <Input
                {...register("postalCode")}
                placeholder="10000"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Grad</label>
              <Input
                {...register("city")}
                placeholder="Zagreb"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kontakt podaci</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                {...register("email")}
                placeholder="email@primjer.hr"
                error={errors.email?.message}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Telefon</label>
              <Input
                {...register("phone")}
                placeholder="+385 1 234 5678"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={loading} className="min-w-[140px]">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Spremanje...</> : "Spremi kontakt"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Odustani
          </Button>
        </div>
      </form>
    </div>
  )
}
