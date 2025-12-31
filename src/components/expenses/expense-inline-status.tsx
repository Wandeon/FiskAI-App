"use client"

import { useTransition, useState } from "react"
import { Loader2, Check, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
// eslint-disable-next-line import/no-restricted-paths -- pre-existing import, to be refactored
import { updateExpenseInline } from "@/app/actions/expense"
import { toast } from "@/lib/toast"
import type { ExpenseStatus } from "@prisma/client"

const STATUS_LABELS: Record<ExpenseStatus, string> = {
  DRAFT: "Nacrt",
  PENDING: "Čeka plaćanje",
  PAID: "Plaćeno",
  CANCELLED: "Otkazano",
}

const STATUS_COLORS: Record<ExpenseStatus, string> = {
  DRAFT: "bg-surface-2 text-foreground",
  PENDING: "bg-warning-bg text-warning-text",
  PAID: "bg-success-bg text-success-text",
  CANCELLED: "bg-danger-bg text-danger-text",
}

export function ExpenseInlineStatus({ id, status }: { id: string; status: ExpenseStatus }) {
  const [current, setCurrent] = useState<ExpenseStatus>(status)
  const [saving, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const cycle = () => {
    // CANCELLED status requires explicit action with confirmation, not included in cycle
    // See: https://github.com/Wandeon/FiskAI/issues/869
    const order: ExpenseStatus[] = ["DRAFT", "PENDING", "PAID"]
    const idx = order.indexOf(current)
    // If current status is CANCELLED, don't allow cycling (requires explicit action to change)
    if (current === "CANCELLED") {
      return current
    }
    return order[(idx + 1) % order.length]
  }

  const save = (next: ExpenseStatus) => {
    startTransition(async () => {
      setError(null)
      const res = await updateExpenseInline(id, { status: next })
      if (res?.success) {
        setCurrent(next)
        toast.success("Status ažuriran")
      } else {
        setError(res?.error || "Greška")
        toast.error("Greška", res?.error || "Status nije ažuriran")
      }
    })
  }

  return (
    <button
      type="button"
      onClick={() => save(cycle())}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition",
        STATUS_COLORS[current]
      )}
      disabled={saving || current === "CANCELLED"}
      aria-label="Promijeni status troška"
    >
      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      {STATUS_LABELS[current]}
      {error && <XCircle className="h-4 w-4 text-danger" />}
    </button>
  )
}
