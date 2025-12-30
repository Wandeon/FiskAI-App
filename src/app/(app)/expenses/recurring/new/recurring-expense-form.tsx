"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/lib/toast"
import { createRecurringExpense } from "@/app/actions/expense"
import { useFormShortcuts } from "@/hooks/use-keyboard-shortcuts"
import type { ExpenseCategory, Frequency } from "@prisma/client"

interface RecurringExpenseFormProps {
  vendors: Array<{ id: string; name: string }>
  categories: ExpenseCategory[]
}

export function RecurringExpenseForm({ vendors, categories }: RecurringExpenseFormProps) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [isLoading, setIsLoading] = useState(false)

  useFormShortcuts({
    onSave: () => {
      if (!isLoading) {
        formRef.current?.requestSubmit()
      }
    },
    onCancel: () => {
      router.push("/expenses/recurring")
    },
    enabled: !isLoading,
  })

  const [categoryId, setCategoryId] = useState("")
  const [vendorId, setVendorId] = useState("")
  const [description, setDescription] = useState("")
  const [netAmount, setNetAmount] = useState("")
  const [vatRate, setVatRate] = useState("25")
  const [frequency, setFrequency] = useState<Frequency>("MONTHLY")
  const [nextDate, setNextDate] = useState(new Date().toISOString().split("T")[0])
  const [endDate, setEndDate] = useState("")

  const net = parseFloat(netAmount) || 0
  const vat = net * (parseFloat(vatRate) / 100)
  const total = net + vat

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!categoryId) {
      toast.error("Odaberite kategoriju")
      return
    }
    if (!description) {
      toast.error("Unesite opis")
      return
    }
    if (net <= 0) {
      toast.error("Unesite iznos")
      return
    }

    setIsLoading(true)
    const result = await createRecurringExpense({
      categoryId,
      vendorId: vendorId || undefined,
      description,
      netAmount: net,
      vatAmount: vat,
      vatRate: parseFloat(vatRate),
      totalAmount: total,
      frequency,
      nextDate: new Date(nextDate),
      endDate: endDate ? new Date(endDate) : undefined,
    })
    setIsLoading(false)

    if (result.success) {
      toast.success("Ponavljajući trošak je spremljen")
      router.push("/expenses/recurring")
    } else {
      toast.error(result.error || "Greška pri spremanju")
    }
  }

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR" }).format(n)

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Osnovni podaci</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Kategorija *</Label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full mt-1 rounded-md border-default"
              required
            >
              <option value="">Odaberite...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Dobavljač</Label>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="w-full mt-1 rounded-md border-default"
            >
              <option value="">Nepoznat</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <Label>Opis *</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Npr. Mjesečna najamnina ureda"
              required
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Iznosi</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <Label>Neto iznos (EUR) *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={netAmount}
              onChange={(e) => setNetAmount(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>PDV stopa</Label>
            <select
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              className="w-full mt-1 rounded-md border-default"
            >
              <option value="25">25%</option>
              <option value="13">13%</option>
              <option value="5">5%</option>
              <option value="0">0%</option>
            </select>
          </div>
        </CardContent>
        <CardContent className="border-t pt-4">
          <div className="flex justify-end">
            <dl className="text-sm space-y-1">
              <div className="flex justify-between gap-8">
                <dt className="text-secondary">Neto:</dt>
                <dd className="font-mono">{formatCurrency(net)}</dd>
              </div>
              <div className="flex justify-between gap-8">
                <dt className="text-secondary">PDV:</dt>
                <dd className="font-mono">{formatCurrency(vat)}</dd>
              </div>
              <div className="flex justify-between gap-8 text-lg border-t pt-2">
                <dt className="font-medium">Ukupno:</dt>
                <dd className="font-bold font-mono">{formatCurrency(total)}</dd>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ponavljanje</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Učestalost *</Label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as Frequency)}
              className="w-full mt-1 rounded-md border-default"
              required
            >
              <option value="WEEKLY">Tjedno</option>
              <option value="MONTHLY">Mjesečno</option>
              <option value="QUARTERLY">Kvartalno</option>
              <option value="YEARLY">Godišnje</option>
            </select>
          </div>
          <div>
            <Label>Sljedeći datum *</Label>
            <Input
              type="date"
              value={nextDate}
              onChange={(e) => setNextDate(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Završava (opciono)</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Link href="/expenses/recurring">
          <Button type="button" variant="outline">
            Odustani
          </Button>
        </Link>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Spremanje..." : "Spremi ponavljajući trošak"}
        </Button>
      </div>
    </form>
  )
}
