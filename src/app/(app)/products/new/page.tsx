"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { productSchema, unitCodes, vatCategories } from "@/lib/validations/product"
import { createProduct } from "@/app/actions/product"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

type ProductFormInput = z.input<typeof productSchema>

export default function NewProductPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProductFormInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      unit: "C62",
      vatRate: 25,
      vatCategory: "S",
      isActive: true,
    },
  })

  // Auto-set VAT rate when category changes
  function handleVatCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const category = e.target.value as "S" | "AA" | "E" | "Z" | "O"
    const vatCat = vatCategories.find((v) => v.code === category)
    if (vatCat) {
      setValue("vatRate", vatCat.rate)
    }
  }

  async function onSubmit(data: ProductFormInput) {
    setLoading(true)
    setError(null)

    const result = await createProduct({
      ...data,
      unit: data.unit || "C62",
      price: Number(data.price) || 0,
      vatRate: Number(data.vatRate) || 25,
      vatCategory: data.vatCategory || "S",
      isActive: data.isActive ?? true,
    })

    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.push("/products")
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Novi proizvod</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {error && <div className="rounded-md bg-danger-bg p-3 text-sm text-danger-text">{error}</div>}

        <Card>
          <CardHeader>
            <CardTitle>Osnovni podaci</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Naziv *</label>
              <Input
                {...register("name")}
                placeholder="Naziv proizvoda ili usluge"
                error={errors.name?.message}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Opis</label>
              <textarea
                className="w-full rounded-md border border-default px-3 py-2 text-sm"
                rows={3}
                {...register("description")}
                placeholder="Kratki opis proizvoda ili usluge"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Šifra (SKU)</label>
              <Input {...register("sku")} placeholder="ABC-123" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Jedinica mjere</label>
              <select
                className="h-10 w-full rounded-md border border-default px-3"
                {...register("unit")}
              >
                {unitCodes.map((unit) => (
                  <option key={unit.code} value={unit.code}>
                    {unit.name} ({unit.code})
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cijena i PDV</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Cijena (EUR) *</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                {...register("price")}
                placeholder="0.00"
                error={errors.price?.message}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">PDV kategorija</label>
              <select
                className="h-10 w-full rounded-md border border-default px-3"
                {...register("vatCategory")}
                onChange={(e) => {
                  register("vatCategory").onChange(e)
                  handleVatCategoryChange(e)
                }}
              >
                {vatCategories.map((vat) => (
                  <option key={vat.code} value={vat.code}>
                    {vat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">PDV stopa (%)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                {...register("vatRate")}
                error={errors.vatRate?.message}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-default"
                {...register("isActive")}
              />
              <span className="text-sm font-medium">Aktivan proizvod</span>
            </label>
            <p className="mt-1 text-sm text-secondary">
              Neaktivni proizvodi neće se prikazivati prilikom kreiranja računa
            </p>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            {loading ? "Spremanje..." : "Spremi proizvod"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Odustani
          </Button>
        </div>
      </form>
    </div>
  )
}
