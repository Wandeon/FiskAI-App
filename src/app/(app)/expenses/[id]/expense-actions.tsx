"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "@/lib/toast"
import { deleteExpense, markExpenseAsPaid } from "@/app/actions/expense"
import type { Expense, PaymentMethod } from "@prisma/client"

export function ExpenseActions({ expense }: { expense: Expense }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const canPay = expense.status !== "PAID" && expense.status !== "CANCELLED"

  async function handlePay(method: PaymentMethod) {
    setIsLoading(true)
    const result = await markExpenseAsPaid(expense.id, method)
    setIsLoading(false)
    if (result.success) {
      toast.success("Trošak označen kao plaćen")
      router.refresh()
    } else {
      toast.error(result.error || "Greška")
    }
  }

  async function handleDelete() {
    if (!confirm("Jeste li sigurni?")) return
    setIsLoading(true)
    const result = await deleteExpense(expense.id)
    setIsLoading(false)
    if (result.success) {
      toast.success("Trošak je obrisan")
      router.push("/expenses")
    } else {
      toast.error(result.error || "Greška")
    }
  }

  return (
    <div className="flex gap-2">
      {canPay && (
        <select
          onChange={(e) => {
            if (e.target.value) handlePay(e.target.value as PaymentMethod)
          }}
          className="rounded-md border-default text-sm"
          disabled={isLoading}
        >
          <option value="">Označi plaćeno...</option>
          <option value="CASH">Gotovina</option>
          <option value="CARD">Kartica</option>
          <option value="TRANSFER">Virman</option>
          <option value="OTHER">Ostalo</option>
        </select>
      )}
      <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
        Obriši
      </Button>
    </div>
  )
}
