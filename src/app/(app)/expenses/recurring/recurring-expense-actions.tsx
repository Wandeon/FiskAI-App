"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { MoreVertical, Trash2, Play, Pause, Edit } from "lucide-react"
import { toast } from "@/lib/toast"
import { deleteRecurringExpense, toggleRecurringExpense } from "@/app/actions/expense"
import type { RecurringExpense } from "@prisma/client"

export function RecurringExpenseActions({ expense }: { expense: RecurringExpense }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isToggling, setIsToggling] = useState(false)

  async function handleDelete() {
    if (!confirm("Jeste li sigurni da želite obrisati ovaj ponavljajući trošak?")) {
      return
    }

    setIsDeleting(true)
    const result = await deleteRecurringExpense(expense.id)
    setIsDeleting(false)

    if (result.success) {
      toast.success("Ponavljajući trošak je obrisan")
      router.refresh()
    } else {
      toast.error(result.error || "Greška pri brisanju")
    }
  }

  async function handleToggle() {
    setIsToggling(true)
    const result = await toggleRecurringExpense(expense.id, !expense.isActive)
    setIsToggling(false)

    if (result.success) {
      toast.success(
        expense.isActive ? "Ponavljajući trošak deaktiviran" : "Ponavljajući trošak aktiviran"
      )
      router.refresh()
    } else {
      toast.error(result.error || "Greška pri promjeni statusa")
    }
  }

  return (
    <div className="relative">
      <Button variant="ghost" size="sm" onClick={() => setIsOpen(!isOpen)} className="h-8 w-8 p-0">
        <MoreVertical className="h-4 w-4" />
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg z-50">
            <div className="p-1">
              <button
                onClick={() => {
                  setIsOpen(false)
                  handleToggle()
                }}
                disabled={isToggling}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-[var(--surface-secondary)] disabled:opacity-50"
              >
                {expense.isActive ? (
                  <>
                    <Pause className="h-4 w-4" />
                    {isToggling ? "Deaktiviranje..." : "Deaktiviraj"}
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    {isToggling ? "Aktiviranje..." : "Aktiviraj"}
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setIsOpen(false)
                  handleDelete()
                }}
                disabled={isDeleting}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-danger-text hover:bg-danger-bg disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting ? "Brisanje..." : "Obriši"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
