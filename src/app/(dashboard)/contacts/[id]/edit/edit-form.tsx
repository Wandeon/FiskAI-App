"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { contactSchema } from "@/lib/validations"
import { updateContact } from "@/app/actions/contact"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { OibInput } from "@/components/ui/oib-input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Contact } from "@prisma/client"

type ContactFormInput = z.input<typeof contactSchema>

interface EditContactFormProps {
  contact: Contact
}

export function EditContactForm({ contact }: EditContactFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<ContactFormInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      type: contact.type,
      name: contact.name,
      oib: contact.oib || "",
      vatNumber: contact.vatNumber || "",
      address: contact.address || "",
      city: contact.city || "",
      postalCode: contact.postalCode || "",
      country: contact.country,
      email: contact.email || "",
      phone: contact.phone || "",
    },
  })

  async function onSubmit(data: ContactFormInput) {
    setLoading(true)
    setError(null)

    const result = await updateContact(contact.id, {
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

  return (
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
            <label className="text-sm font-medium">Naziv *</label>
            <Input
              {...register("name")}
              placeholder="Naziv tvrtke ili ime osobe"
              error={errors.name?.message}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">OIB</label>
            <OibInput
              value={contact.oib || ""}
              onChange={(val) => setValue("oib", val)}
              error={errors.oib?.message}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">VAT broj</label>
            <Input
              {...register("vatNumber")}
              placeholder="HR12345678901"
            />
          </div>
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Država</label>
            <Input
              {...register("country")}
              placeholder="HR"
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
        <Button type="submit" disabled={loading}>
          {loading ? "Spremanje..." : "Spremi promjene"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Odustani
        </Button>
      </div>
    </form>
  )
}
