"use client"

import { useState } from "react"
import { Pencil, Check, X, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export interface ExtractedLineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
  amount: number
}

export interface ExtractedInvoice {
  vendor: {
    name: string
    oib: string | null
    address: string | null
    iban: string | null
    bankName: string | null
  }
  invoice: {
    number: string
    issueDate: string
    dueDate: string | null
    deliveryDate: string | null
  }
  lineItems: ExtractedLineItem[]
  subtotal: number
  taxAmount: number
  totalAmount: number
  currency: string
  payment: {
    iban: string | null
    model: string | null
    reference: string | null
  }
  mathValid: boolean
}

interface InvoiceEditorProps {
  data: ExtractedInvoice
  onChange: (data: ExtractedInvoice) => void
}

export function InvoiceEditor({ data, onChange }: InvoiceEditorProps) {
  const [editingLineId, setEditingLineId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<ExtractedLineItem>>({})
  const [editingField, setEditingField] = useState<string | null>(null)

  // Calculate totals from line items
  const calculatedSubtotal = data.lineItems.reduce((sum, item) => sum + item.amount, 0)
  const calculatedTax = data.lineItems.reduce(
    (sum, item) => sum + (item.amount * item.taxRate) / 100,
    0
  )
  const calculatedTotal = calculatedSubtotal + calculatedTax

  // Validate math
  const mathValid = Math.abs(calculatedTotal - data.totalAmount) < 0.01

  const startEditLine = (item: ExtractedLineItem) => {
    setEditingLineId(item.id)
    setEditForm({ ...item })
  }

  const cancelEditLine = () => {
    setEditingLineId(null)
    setEditForm({})
  }

  const saveEditLine = () => {
    if (editingLineId && editForm) {
      const updatedItems = data.lineItems.map((item) =>
        item.id === editingLineId ? { ...item, ...editForm } : item
      )
      onChange({ ...data, lineItems: updatedItems })
      setEditingLineId(null)
      setEditForm({})
    }
  }

  const updateLineForm = (field: keyof ExtractedLineItem, value: any) => {
    setEditForm((prev) => {
      const updated = { ...prev, [field]: value }
      // Auto-calculate amount when quantity or unit price changes
      if (field === "quantity" || field === "unitPrice") {
        const qty = field === "quantity" ? value : prev.quantity || 0
        const price = field === "unitPrice" ? value : prev.unitPrice || 0
        updated.amount = qty * price
      }
      return updated
    })
  }

  const addLineItem = () => {
    const newItem: ExtractedLineItem = {
      id: `line-${Date.now()}`,
      description: "Nova stavka",
      quantity: 1,
      unitPrice: 0,
      taxRate: 25,
      amount: 0,
    }
    onChange({ ...data, lineItems: [...data.lineItems, newItem] })
  }

  const removeLineItem = (id: string) => {
    onChange({ ...data, lineItems: data.lineItems.filter((item) => item.id !== id) })
  }

  const updateVendor = (field: string, value: string) => {
    onChange({ ...data, vendor: { ...data.vendor, [field]: value } })
  }

  const updateInvoice = (field: string, value: string) => {
    onChange({ ...data, invoice: { ...data.invoice, [field]: value } })
  }

  const updatePayment = (field: string, value: string) => {
    onChange({ ...data, payment: { ...data.payment, [field]: value } })
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Vendor Info */}
      <div className="p-4 border-b bg-surface-1">
        <h3 className="font-semibold text-lg mb-3">Dobavljač</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-tertiary">Naziv</label>
            <Input
              value={data.vendor.name}
              onChange={(e) => updateVendor("name", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-tertiary">OIB</label>
            <Input
              value={data.vendor.oib || ""}
              onChange={(e) => updateVendor("oib", e.target.value)}
              placeholder="11 znamenki"
              className="h-8 text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-tertiary">Adresa</label>
            <Input
              value={data.vendor.address || ""}
              onChange={(e) => updateVendor("address", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Invoice Details */}
      <div className="p-4 border-b">
        <h3 className="font-semibold text-lg mb-3">Podaci računa</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-tertiary">Broj računa</label>
            <Input
              value={data.invoice.number}
              onChange={(e) => updateInvoice("number", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-tertiary">Datum računa</label>
            <Input
              type="date"
              value={data.invoice.issueDate}
              onChange={(e) => updateInvoice("issueDate", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-tertiary">Datum dospijeća</label>
            <Input
              type="date"
              value={data.invoice.dueDate || ""}
              onChange={(e) => updateInvoice("dueDate", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-tertiary">Datum isporuke</label>
            <Input
              type="date"
              value={data.invoice.deliveryDate || ""}
              onChange={(e) => updateInvoice("deliveryDate", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="p-4 border-b flex-1">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg">Stavke</h3>
          <Button variant="outline" size="sm" onClick={addLineItem}>
            <Plus className="h-4 w-4 mr-1" />
            Dodaj
          </Button>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-surface-2">
            <tr>
              <th className="text-left p-2">Opis</th>
              <th className="text-right p-2 w-16">Kol.</th>
              <th className="text-right p-2 w-24">Cijena</th>
              <th className="text-right p-2 w-16">PDV%</th>
              <th className="text-right p-2 w-24">Iznos</th>
              <th className="text-center p-2 w-16">Akcije</th>
            </tr>
          </thead>
          <tbody>
            {data.lineItems.map((item) => {
              const isEditing = editingLineId === item.id
              return (
                <tr key={item.id} className="border-b hover:bg-surface-1">
                  <td className="p-2">
                    {isEditing ? (
                      <Input
                        value={editForm.description || ""}
                        onChange={(e) => updateLineForm("description", e.target.value)}
                        className="h-7 text-sm"
                      />
                    ) : (
                      <span className="truncate block max-w-[200px]">{item.description}</span>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editForm.quantity || ""}
                        onChange={(e) => updateLineForm("quantity", parseFloat(e.target.value))}
                        className="h-7 text-sm w-16"
                      />
                    ) : (
                      item.quantity
                    )}
                  </td>
                  <td className="p-2 text-right">
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editForm.unitPrice || ""}
                        onChange={(e) => updateLineForm("unitPrice", parseFloat(e.target.value))}
                        className="h-7 text-sm w-24"
                      />
                    ) : (
                      `${item.unitPrice.toFixed(2)}`
                    )}
                  </td>
                  <td className="p-2 text-right">
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editForm.taxRate || ""}
                        onChange={(e) => updateLineForm("taxRate", parseFloat(e.target.value))}
                        className="h-7 text-sm w-16"
                      />
                    ) : (
                      `${item.taxRate}%`
                    )}
                  </td>
                  <td className="p-2 text-right font-medium">
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editForm.amount || ""}
                        onChange={(e) => updateLineForm("amount", parseFloat(e.target.value))}
                        className="h-7 text-sm w-24"
                      />
                    ) : (
                      `${item.amount.toFixed(2)}`
                    )}
                  </td>
                  <td className="p-2 text-center">
                    {isEditing ? (
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={saveEditLine}
                          className="h-7 w-7 p-0"
                        >
                          <Check className="h-4 w-4 text-success-text" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={cancelEditLine}
                          className="h-7 w-7 p-0"
                        >
                          <X className="h-4 w-4 text-danger-text" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditLine(item)}
                          className="h-7 w-7 p-0"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLineItem(item.id)}
                          className="h-7 w-7 p-0"
                        >
                          <Trash2 className="h-4 w-4 text-danger-icon" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {data.lineItems.length === 0 && (
          <div className="text-center py-4 text-tertiary text-sm">
            Nema stavki. Kliknite &quot;Dodaj&quot; za dodavanje.
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="p-4 border-b bg-surface-1">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-secondary">Osnovica:</span>
              <span className="font-medium">
                {calculatedSubtotal.toFixed(2)} {data.currency}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-secondary">PDV:</span>
              <span className="font-medium">
                {calculatedTax.toFixed(2)} {data.currency}
              </span>
            </div>
            <div className="flex justify-between text-base font-semibold border-t pt-2">
              <span>Ukupno:</span>
              <span>
                {calculatedTotal.toFixed(2)} {data.currency}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-secondary">Navedeno na računu:</span>
              <span className="font-medium">
                {data.totalAmount.toFixed(2)} {data.currency}
              </span>
            </div>
            <div
              className={`flex justify-between text-sm font-semibold ${mathValid ? "text-success-text" : "text-danger-text"}`}
            >
              <span>Status:</span>
              <span>{mathValid ? "Ispravan" : "Neispravan"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Info */}
      <div className="p-4 bg-info-bg">
        <h3 className="font-semibold text-lg mb-3">Podaci za plaćanje</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-tertiary">IBAN primatelja</label>
            <Input
              value={data.payment.iban || data.vendor.iban || ""}
              onChange={(e) => updatePayment("iban", e.target.value)}
              placeholder="HR..."
              className="h-8 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-tertiary">Model</label>
            <Input
              value={data.payment.model || ""}
              onChange={(e) => updatePayment("model", e.target.value)}
              placeholder="HR00"
              className="h-8 text-sm"
            />
          </div>
          <div className="col-span-3">
            <label className="text-xs text-tertiary">Poziv na broj primatelja</label>
            <Input
              value={data.payment.reference || ""}
              onChange={(e) => updatePayment("reference", e.target.value)}
              className="h-8 text-sm font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
