"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/lib/toast"
import { createInvoice } from "@/app/actions/invoice"
import { InvoiceType } from "@prisma/client"
import { useFormShortcuts } from "@/hooks/use-keyboard-shortcuts"

interface InvoiceFormProps {
  type: string
  contacts: Array<{ id: string; name: string; oib: string | null }>
  products: Array<{
    id: string
    name: string
    price: number | { toNumber(): number }
    vatRate: number | { toNumber(): number }
    unit: string
  }>
  isPausalni?: boolean
}

interface LineItem {
  description: string
  quantity: number
  unit: string
  unitPrice: number
  vatRate: number
}

export function InvoiceForm({ type, contacts, products, isPausalni = false }: InvoiceFormProps) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [buyerId, setBuyerId] = useState("")
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0])
  const [dueDate, setDueDate] = useState("")
  const [notes, setNotes] = useState("")
  // Paušalni obrt uses 0% VAT always
  const defaultVatRate = isPausalni ? 0 : 25
  const [lines, setLines] = useState<LineItem[]>([
    { description: "", quantity: 1, unit: "C62", unitPrice: 0, vatRate: defaultVatRate },
  ])

  // Keyboard shortcuts: Ctrl+S to save, Escape to cancel
  useFormShortcuts({
    onSave: () => {
      if (!isLoading) {
        formRef.current?.requestSubmit()
      }
    },
    onCancel: () => router.push("/invoices"),
    enabled: !isLoading,
  })

  function addLine() {
    setLines([
      ...lines,
      { description: "", quantity: 1, unit: "C62", unitPrice: 0, vatRate: defaultVatRate },
    ])
  }

  function removeLine(index: number) {
    if (lines.length === 1) return
    setLines(lines.filter((_, i) => i !== index))
  }

  function updateLine(index: number, field: keyof LineItem, value: string | number) {
    const newLines = [...lines]
    newLines[index] = { ...newLines[index], [field]: value }
    setLines(newLines)
  }

  function addProduct(productId: string) {
    const product = products.find((p) => p.id === productId)
    if (!product) return

    const price = typeof product.price === "number" ? product.price : Number(product.price)
    // Force 0% VAT for paušalni obrt
    const vatRate = isPausalni
      ? 0
      : typeof product.vatRate === "number"
        ? product.vatRate
        : Number(product.vatRate)

    setLines([
      ...lines,
      {
        description: product.name,
        quantity: 1,
        unit: product.unit,
        unitPrice: price,
        vatRate: vatRate,
      },
    ])
  }

  // Calculate totals
  const totals = lines.reduce(
    (acc, line) => {
      const net = line.quantity * line.unitPrice
      const vat = net * (line.vatRate / 100)
      return {
        netAmount: acc.netAmount + net,
        vatAmount: acc.vatAmount + vat,
        totalAmount: acc.totalAmount + net + vat,
      }
    },
    { netAmount: 0, vatAmount: 0, totalAmount: 0 }
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!buyerId) {
      toast.error("Odaberite kupca")
      return
    }

    if (lines.some((l) => !l.description || l.unitPrice <= 0)) {
      toast.error("Ispunite sve stavke")
      return
    }

    setIsLoading(true)

    const result = await createInvoice({
      type: type as InvoiceType,
      buyerId,
      issueDate: new Date(issueDate),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      notes: notes || undefined,
      lines,
    })

    setIsLoading(false)

    if (result.success) {
      toast.success("Dokument je kreiran")
      router.push("/invoices")
    } else {
      toast.error(result.error || "Greška pri kreiranju")
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR" }).format(amount)

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Osnovni podaci</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="buyerId">Kupac *</Label>
            <select
              id="buyerId"
              value={buyerId}
              onChange={(e) => setBuyerId(e.target.value)}
              className="w-full mt-1 rounded-md border-gray-300"
              required
            >
              <option value="">Odaberite kupca...</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.oib ? `(${c.oib})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="issueDate">Datum izdavanja *</Label>
              <Input
                id="issueDate"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="dueDate">Rok plaćanja</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Stavke</CardTitle>
          {products.length > 0 && (
            <select
              onChange={(e) => {
                if (e.target.value) addProduct(e.target.value)
                e.target.value = ""
              }}
              className="text-sm rounded-md border-gray-300"
            >
              <option value="">+ Dodaj proizvod...</option>
              {products.map((p) => {
                const price = typeof p.price === "number" ? p.price : Number(p.price)
                return (
                  <option key={p.id} value={p.id}>
                    {p.name} - {formatCurrency(price)}
                  </option>
                )
              })}
            </select>
          )}
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 w-1/3">Opis</th>
                <th className="py-2 w-20">Količina</th>
                <th className="py-2 w-24">Jedinica</th>
                <th className="py-2 w-28">Cijena</th>
                <th className="py-2 w-20">PDV %</th>
                <th className="py-2 w-28 text-right">Iznos</th>
                <th className="py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index} className="border-b">
                  <td className="py-2 pr-2">
                    <Input
                      value={line.description}
                      onChange={(e) => updateLine(index, "description", e.target.value)}
                      placeholder="Opis stavke"
                      required
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(index, "quantity", parseFloat(e.target.value) || 0)
                      }
                      required
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      value={line.unit}
                      onChange={(e) => updateLine(index, "unit", e.target.value)}
                      className="w-full rounded-md border-gray-300 text-sm"
                    >
                      <option value="C62">kom</option>
                      <option value="HUR">sat</option>
                      <option value="DAY">dan</option>
                      <option value="MON">mjesec</option>
                      <option value="KGM">kg</option>
                      <option value="MTR">m</option>
                      <option value="LTR">L</option>
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(e) =>
                        updateLine(index, "unitPrice", parseFloat(e.target.value) || 0)
                      }
                      required
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      value={isPausalni ? 0 : line.vatRate}
                      onChange={(e) => updateLine(index, "vatRate", parseFloat(e.target.value))}
                      className="w-full rounded-md border-gray-300 text-sm disabled:bg-gray-100"
                      disabled={isPausalni}
                      title={isPausalni ? "Paušalni obrt ne obračunava PDV" : undefined}
                    >
                      {isPausalni ? (
                        <option value="0">0% (paušalni)</option>
                      ) : (
                        <>
                          <option value="25">25%</option>
                          <option value="13">13%</option>
                          <option value="5">5%</option>
                          <option value="0">0%</option>
                        </>
                      )}
                    </select>
                  </td>
                  <td className="py-2 text-right font-mono">
                    {formatCurrency(line.quantity * line.unitPrice * (1 + line.vatRate / 100))}
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      className="text-red-500 hover:text-red-700 px-2"
                      disabled={lines.length === 1}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button type="button" variant="outline" size="sm" onClick={addLine} className="mt-4">
            + Dodaj stavku
          </Button>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-end">
            <dl className="text-sm space-y-1">
              <div className="flex justify-between gap-8">
                <dt className="text-gray-500">Osnovica:</dt>
                <dd className="font-mono">{formatCurrency(totals.netAmount)}</dd>
              </div>
              <div className="flex justify-between gap-8">
                <dt className="text-gray-500">PDV:</dt>
                <dd className="font-mono">{formatCurrency(totals.vatAmount)}</dd>
              </div>
              <div className="flex justify-between gap-8 text-lg border-t pt-2">
                <dt className="font-medium">Ukupno:</dt>
                <dd className="font-bold font-mono">{formatCurrency(totals.totalAmount)}</dd>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>

      {/* Paušalni VAT notice */}
      {isPausalni && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            <strong>Paušalni obrt:</strong> Kao paušalni obrtnik niste u sustavu PDV-a i ne
            obračunavate PDV na račune. Svi iznosi su prikazani bez PDV-a.
          </p>
        </div>
      )}

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Napomene</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border-gray-300 text-sm"
            rows={3}
            placeholder="Dodatne napomene..."
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Link href="/invoices">
          <Button type="button" variant="outline">
            Odustani
          </Button>
        </Link>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Spremanje..." : "Spremi dokument"}
        </Button>
      </div>
    </form>
  )
}
