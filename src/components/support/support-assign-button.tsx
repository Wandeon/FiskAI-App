"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/lib/toast"

export function AssignSupportTicketButton({
  ticketId,
  currentAssigneeId,
  currentUserId,
}: {
  ticketId: string
  currentAssigneeId: string | null
  currentUserId: string
}) {
  const [pending, startTransition] = useTransition()

  const onAssign = async () => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/support/tickets/${ticketId}/assign`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: currentAssigneeId ? null : currentUserId
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          toast.error("Greška", data.error || "Dodjela nije uspjela")
          return
        }

        toast.success(currentAssigneeId ? "Maknuta dodjela" : "Tiket preuzet", "Osvježite da vidite promjenu")
      } catch (error) {
        toast.error("Greška", "Nije uspjelo dodjeljivanje tiketa")
      }
    })
  }

  return (
    <Button variant="outline" size="sm" onClick={onAssign} disabled={pending}>
      {pending ? "Spremam..." : currentAssigneeId ? "Makni dodjelu" : "Preuzmi tiket"}
    </Button>
  )
}
