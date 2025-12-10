"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { eInvoiceSchema } from "@/lib/validations"
import { createEInvoice } from "@/app/actions/e-invoice"
import { z } from "zod"

type EInvoiceFormInput = z.input<typeof eInvoiceSchema>
import { getContacts } from "@/app/actions/contact"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Contact } from "@prisma/client"

export default function NewEInvoicePage() {
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<EInvoiceFormInput>({
    resolver: zodResolver(eInvoiceSchema),
    defaultValues: {
      issueDate: new Date(),
      currency: "EUR",
      lines: [
        {
          description: "",
          quantity: 1,
          unit: "C62",
          unitPrice: 0,
          vatRate: 25,
          vatCategory: "S",
        },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lines",
  })

  useEffect(() => {
    getContacts("CUSTOMER").then(setContacts)
  }, [])

  const lines = watch("lines")
  const totals = lines.reduce(
    (acc, line) => {
      const net = (line.quantity || 0) * (line.unitPrice || 0)
      const vat = net * ((line.vatRate || 0) / 100)
      return {
        net: acc.net + net,
        vat: acc.vat + vat,
        total: acc.total + net + vat,
      }
    },
    { net: 0, vat: 0, total: 0 }
  )

  async function onSubmit(data: EInvoiceFormInput) {
    setLoading(true)
    setError(null)

    const result = await createEInvoice(data)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.push("/e-invoices")
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Novi E-Račun</h1>

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
              <label className="text-sm font-medium">Kupac</label>
              <select
                className="h-10 w-full rounded-md border border-gray-300 px-3"
                {...register("buyerId")}
              >
                <option value="">Odaberite kupca</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name} {contact.oib && `(${contact.oib})`}
                  </option>
                ))}
              </select>
              {errors.buyerId && (
                <p className="text-sm text-red-500">{errors.buyerId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Broj računa</label>
              <Input
                {...register("invoiceNumber")}
                error={errors.invoiceNumber?.message}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Datum izdavanja</label>
              <Input
                type="date"
                {...register("issueDate")}
                error={errors.issueDate?.message}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Datum dospijeća</label>
              <Input type="date" {...register("dueDate")} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Referenca kupca</label>
              <Input {...register("buyerReference")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Stavke</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({
                  description: "",
                  quantity: 1,
                  unit: "C62",
                  unitPrice: 0,
                  vatRate: 25,
                  vatCategory: "S",
                })
              }
            >
              Dodaj stavku
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid gap-4 rounded-md border p-4 md:grid-cols-6"
              >
                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Opis</label>
                  <Input {...register(`lines.${index}.description`)} />
                </div>
                <div>
                  <label className="text-sm font-medium">Količina</label>
                  <Input
                    type="number"
                    step="0.001"
                    {...register(`lines.${index}.quantity`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Cijena</label>
                  <Input
                    type="number"
                    step="0.01"
                    {...register(`lines.${index}.unitPrice`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">PDV %</label>
                  <Input
                    type="number"
                    {...register(`lines.${index}.vatRate`, {
                      valueAsNumber: true,
                    })}
                  />
                </div>
                <div className="flex items-end">
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => remove(index)}
                    >
                      Ukloni
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-end space-y-1 text-right">
              <div className="space-y-1">
                <p className="text-sm text-gray-500">
                  Neto: {totals.net.toFixed(2)} EUR
                </p>
                <p className="text-sm text-gray-500">
                  PDV: {totals.vat.toFixed(2)} EUR
                </p>
                <p className="text-lg font-bold">
                  Ukupno: {totals.total.toFixed(2)} EUR
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            {loading ? "Spremanje..." : "Spremi kao nacrt"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Odustani
          </Button>
        </div>
      </form>
    </div>
  )
}
