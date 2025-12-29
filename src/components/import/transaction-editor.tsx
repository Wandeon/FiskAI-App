"use client"

import { useState } from "react"
import { Pencil, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export interface ExtractedTransaction {
  id: string
  date: string
  description: string
  amount: number
  direction: "INCOMING" | "OUTGOING"
  counterpartyName?: string
  counterpartyIban?: string
  reference?: string
}

interface TransactionEditorProps {
  transactions: ExtractedTransaction[]
  openingBalance?: number
  closingBalance?: number
  mathValid: boolean
  onChange: (transactions: ExtractedTransaction[]) => void
}

export function TransactionEditor({
  transactions,
  openingBalance,
  closingBalance,
  mathValid,
  onChange,
}: TransactionEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<ExtractedTransaction>>({})

  const totalIncoming = transactions
    .filter((t) => t.direction === "INCOMING")
    .reduce((sum, t) => sum + t.amount, 0)

  const totalOutgoing = transactions
    .filter((t) => t.direction === "OUTGOING")
    .reduce((sum, t) => sum + t.amount, 0)

  const calculatedClosing = (openingBalance || 0) + totalIncoming - totalOutgoing

  const startEdit = (transaction: ExtractedTransaction) => {
    setEditingId(transaction.id)
    setEditForm({ ...transaction })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const saveEdit = () => {
    if (editingId && editForm) {
      const updatedTransactions = transactions.map((t) =>
        t.id === editingId ? { ...t, ...editForm } : t
      )
      onChange(updatedTransactions)
      setEditingId(null)
      setEditForm({})
    }
  }

  const updateEditForm = (field: keyof ExtractedTransaction, value: any) => {
    setEditForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Summary Header */}
      <div className="p-4 border-b bg-surface-1">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-lg">Transakcije</h3>
          <span className="text-sm text-secondary">{transactions.length} stavki</span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="flex justify-between">
              <span className="text-secondary">Početni saldo:</span>
              <span className="font-medium">
                {openingBalance !== null && openingBalance !== undefined
                  ? openingBalance.toFixed(2)
                  : "N/A"}{" "}
                EUR
              </span>
            </div>
            <div className="flex justify-between text-success-text">
              <span>Ukupno uplate:</span>
              <span className="font-medium">+{totalIncoming.toFixed(2)} EUR</span>
            </div>
            <div className="flex justify-between text-danger-text">
              <span>Ukupno isplate:</span>
              <span className="font-medium">-{totalOutgoing.toFixed(2)} EUR</span>
            </div>
          </div>
          <div>
            <div className="flex justify-between">
              <span className="text-secondary">Izračunati saldo:</span>
              <span className="font-medium">{calculatedClosing.toFixed(2)} EUR</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Navedeni saldo:</span>
              <span className="font-medium">
                {closingBalance !== null && closingBalance !== undefined
                  ? closingBalance.toFixed(2)
                  : "N/A"}{" "}
                EUR
              </span>
            </div>
            <div
              className={`flex justify-between font-semibold ${
                mathValid ? "text-success-text" : "text-danger-text"
              }`}
            >
              <span>Status:</span>
              <span>{mathValid ? "Ispravan" : "Neispravan"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-surface-2 sticky top-0">
            <tr>
              <th className="text-left p-2 text-sm font-semibold">Datum</th>
              <th className="text-left p-2 text-sm font-semibold">Opis</th>
              <th className="text-left p-2 text-sm font-semibold">Druga strana</th>
              <th className="text-right p-2 text-sm font-semibold">Iznos</th>
              <th className="text-center p-2 text-sm font-semibold w-16">Akcije</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => {
              const isEditing = editingId === transaction.id
              return (
                <tr key={transaction.id} className="border-b hover:bg-surface-1">
                  <td className="p-2 text-sm">
                    {isEditing ? (
                      <Input
                        type="date"
                        value={editForm.date || ""}
                        onChange={(e) => updateEditForm("date", e.target.value)}
                        className="h-8"
                      />
                    ) : (
                      transaction.date
                    )}
                  </td>
                  <td className="p-2 text-sm">
                    {isEditing ? (
                      <Input
                        value={editForm.description || ""}
                        onChange={(e) => updateEditForm("description", e.target.value)}
                        className="h-8"
                      />
                    ) : (
                      transaction.description
                    )}
                  </td>
                  <td className="p-2 text-sm">
                    {isEditing ? (
                      <Input
                        value={editForm.counterpartyName || ""}
                        onChange={(e) => updateEditForm("counterpartyName", e.target.value)}
                        placeholder="Naziv druge strane"
                        className="h-8"
                      />
                    ) : (
                      transaction.counterpartyName || "-"
                    )}
                  </td>
                  <td
                    className={`p-2 text-sm text-right font-medium ${
                      transaction.direction === "INCOMING" ? "text-success-text" : "text-danger-text"
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2 justify-end">
                        <Input
                          type="number"
                          step="0.01"
                          value={editForm.amount || ""}
                          onChange={(e) => updateEditForm("amount", parseFloat(e.target.value))}
                          className="h-8 w-32"
                        />
                        <select
                          value={editForm.direction || "INCOMING"}
                          onChange={(e) =>
                            updateEditForm("direction", e.target.value as "INCOMING" | "OUTGOING")
                          }
                          className="h-8 border rounded px-2"
                        >
                          <option value="INCOMING">Uplata</option>
                          <option value="OUTGOING">Isplata</option>
                        </select>
                      </div>
                    ) : (
                      <>
                        {transaction.direction === "INCOMING" ? "+" : "-"}
                        {transaction.amount.toFixed(2)} EUR
                      </>
                    )}
                  </td>
                  <td className="p-2 text-center">
                    {isEditing ? (
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={saveEdit}
                          className="h-7 w-7 p-0"
                        >
                          <Check className="h-4 w-4 text-success-text" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={cancelEdit}
                          className="h-7 w-7 p-0"
                        >
                          <X className="h-4 w-4 text-danger-text" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(transaction)}
                        className="h-7 w-7 p-0"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {transactions.length === 0 && (
          <div className="text-center py-8 text-tertiary">Nema pronađenih transakcija</div>
        )}
      </div>
    </div>
  )
}
