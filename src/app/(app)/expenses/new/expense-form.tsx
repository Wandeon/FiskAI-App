"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Camera, Sparkles, Loader2, Paperclip, X } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/lib/toast"
import { createExpense } from "@/app/actions/expense"
import { ReceiptScanner } from "@/components/expense/receipt-scanner"
import { useFormShortcuts } from "@/hooks/use-keyboard-shortcuts"
import type { ExpenseCategory } from "@prisma/client"
import type { ExtractedReceipt, CategorySuggestion } from "@/lib/ai/types"

interface ExtractedReceiptWithUrl extends ExtractedReceipt {
  receiptUrl?: string
}

interface ExpenseFormProps {
  vendors: Array<{ id: string; name: string }>
  categories: ExpenseCategory[]
}

export function ExpenseForm({ vendors, categories }: ExpenseFormProps) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  // Keyboard shortcuts: Ctrl+S to save, Escape to cancel
  useFormShortcuts({
    onSave: () => {
      if (!isLoading && !showScanner) {
        formRef.current?.requestSubmit()
      }
    },
    onCancel: () => {
      if (showScanner) {
        setShowScanner(false)
      } else {
        router.push("/expenses")
      }
    },
    enabled: !isLoading,
  })
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [categoryId, setCategoryId] = useState("")
  const [vendorId, setVendorId] = useState("")
  const [vendorName, setVendorName] = useState("")
  const [vendorOib, setVendorOib] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [dueDate, setDueDate] = useState("")
  const [description, setDescription] = useState("")
  const [netAmount, setNetAmount] = useState("")
  const [vatRate, setVatRate] = useState("25")
  const [vatDeductible, setVatDeductible] = useState(true)
  const [paymentMethod, setPaymentMethod] = useState("")
  const [notes, setNotes] = useState("")
  const [receiptUrl, setReceiptUrl] = useState<string | undefined>(undefined)

  const net = parseFloat(netAmount) || 0
  const vat = net * (parseFloat(vatRate) / 100)
  const total = net + vat

  // Auto-suggest category when description or vendor changes
  useEffect(() => {
    const getSuggestions = async () => {
      if (!description && !vendorName) {
        setSuggestions([])
        return
      }

      setLoadingSuggestions(true)
      try {
        const response = await fetch("/api/ai/suggest-category", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: description || "",
            vendor: vendorName || "",
            companyId: "current", // Will be set by API from session
          }),
        })

        if (response.ok) {
          const data = await response.json()
          setSuggestions(data.suggestions || [])
        }
      } catch (error) {
        console.error("Failed to get suggestions:", error)
      } finally {
        setLoadingSuggestions(false)
      }
    }

    const timeoutId = setTimeout(getSuggestions, 500)
    return () => clearTimeout(timeoutId)
  }, [description, vendorName])

  const handleExtracted = (data: ExtractedReceiptWithUrl) => {
    // Fill form with extracted data
    setVendorName(data.vendor)
    if (data.vendorOib) setVendorOib(data.vendorOib)
    setDate(data.date)

    // Calculate net amount from total and VAT
    const extractedTotal = data.total
    const extractedVat = data.vatAmount
    const extractedNet = extractedTotal - extractedVat

    setNetAmount(extractedNet.toFixed(2))

    // Determine VAT rate from extracted data
    if (extractedVat > 0 && extractedNet > 0) {
      const rate = (extractedVat / extractedNet) * 100
      if (Math.abs(rate - 25) < 1) setVatRate("25")
      else if (Math.abs(rate - 13) < 1) setVatRate("13")
      else if (Math.abs(rate - 5) < 1) setVatRate("5")
    }

    // Set payment method
    if (data.paymentMethod) {
      const methodMap: Record<string, string> = {
        cash: "CASH",
        card: "CARD",
        transfer: "TRANSFER",
      }
      setPaymentMethod(methodMap[data.paymentMethod] || "")
    }

    // Set description from items
    if (data.items.length > 0) {
      const itemsDesc = data.items
        .map((item) => `${item.description} (${item.quantity}x)`)
        .join(", ")
      setDescription(itemsDesc)
    }

    // Store receipt URL if uploaded
    if (data.receiptUrl) {
      setReceiptUrl(data.receiptUrl)
    }

    setShowScanner(false)
    toast.success("Podaci uspješno izvučeni iz računa!")
  }

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
    const result = await createExpense({
      categoryId,
      vendorId: vendorId || undefined,
      description,
      date: new Date(date),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      netAmount: net,
      vatAmount: vat,
      totalAmount: total,
      vatDeductible,
      paymentMethod: paymentMethod || undefined,
      notes: notes || undefined,
      receiptUrl,
    })
    setIsLoading(false)

    if (result.success) {
      toast.success("Trošak je spremljen")
      router.push("/expenses")
    } else {
      toast.error(result.error || "Greška pri spremanju")
    }
  }

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR" }).format(n)

  if (showScanner) {
    return <ReceiptScanner onExtracted={handleExtracted} onCancel={() => setShowScanner(false)} />
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      <div className="flex justify-end items-center gap-4">
        {receiptUrl && (
          <div className="flex items-center gap-2 text-sm text-success-text bg-success-bg px-3 py-1.5 rounded-md">
            <Paperclip className="h-4 w-4" />
            <span>Račun priložen</span>
            <button
              type="button"
              onClick={() => setReceiptUrl(undefined)}
              className="text-success-text hover:text-success-text"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <Button type="button" variant="outline" onClick={() => setShowScanner(true)}>
          <Camera className="h-4 w-4 mr-2" />
          Skeniraj račun
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Osnovni podaci</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>
              Kategorija *
              {loadingSuggestions && <Loader2 className="h-3 w-3 ml-2 inline animate-spin" />}
            </Label>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value)
                const cat = categories.find((c) => c.id === e.target.value)
                if (cat) setVatDeductible(cat.vatDeductibleDefault)
              }}
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
            {suggestions.length > 0 && (
              <div className="mt-2 space-y-2">
                <span className="text-xs text-secondary flex items-center">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Prijedlozi:
                </span>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <div key={suggestion.categoryId} className="group relative">
                      <Badge
                        variant="secondary"
                        className="cursor-pointer hover:bg-surface-2"
                        onClick={() => setCategoryId(suggestion.categoryId)}
                      >
                        {suggestion.categoryName}
                        <span className="ml-1 text-xs opacity-70">
                          ({Math.round(suggestion.confidence * 100)}%)
                        </span>
                      </Badge>
                      {suggestion.reason && (
                        <div className="absolute z-10 hidden group-hover:block bottom-full left-0 mb-1 px-2 py-1 text-xs text-white bg-surface-2 rounded shadow-lg whitespace-nowrap">
                          {suggestion.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            <Label>Dobavljač</Label>
            <select
              value={vendorId}
              onChange={(e) => {
                setVendorId(e.target.value)
                const v = vendors.find((x) => x.id === e.target.value)
                setVendorName(v?.name || "")
              }}
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
          <div>
            <Label>OIB dobavljača</Label>
            <Input
              value={vendorOib}
              onChange={(e) => setVendorOib(e.target.value)}
              placeholder="12345678901"
              maxLength={11}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Opis *</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Npr. Uredski materijal - papir A4"
              required
            />
          </div>
          <div>
            <Label>Datum *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <Label>Rok plaćanja</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
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
          <div className="flex items-end">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={vatDeductible}
                onChange={(e) => setVatDeductible(e.target.checked)}
                className="rounded"
              />
              PDV priznati
            </label>
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
          <CardTitle className="text-base">Plaćanje</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <Label>Način plaćanja</Label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full mt-1 rounded-md border-default"
            >
              <option value="">Nije plaćeno</option>
              <option value="CASH">Gotovina</option>
              <option value="CARD">Kartica</option>
              <option value="TRANSFER">Virman</option>
              <option value="OTHER">Ostalo</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Napomene</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border-default text-sm"
            rows={3}
            placeholder="Dodatne napomene..."
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Link href="/expenses">
          <Button type="button" variant="outline">
            Odustani
          </Button>
        </Link>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Spremanje..." : "Spremi trošak"}
        </Button>
      </div>
    </form>
  )
}
