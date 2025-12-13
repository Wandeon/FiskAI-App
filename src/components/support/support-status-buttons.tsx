"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/lib/toast"

export function CloseSupportTicketButton({ ticketId }: { ticketId: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            const res = await fetch(`/api/support/tickets/${ticketId}/status`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ status: 'CLOSED' }),
            })

            const data = await res.json()

            if (!res.ok) {
              toast.error("Greška", data.error || "Nije moguće zatvoriti tiket")
              return
            }

            toast.success("Tiket zatvoren", "Zatvoreno od strane računovodstva")
          } catch (error) {
            toast.error("Greška", "Neuspjelo slanje zahtjeva")
          }
        })
      }
    >
      {pending ? "Zatvaram..." : "Zatvori tiket"}
    </Button>
  )
}

export function ReopenSupportTicketButton({ ticketId }: { ticketId: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            const res = await fetch(`/api/support/tickets/${ticketId}/status`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ status: 'OPEN' }),
            })

            const data = await res.json()

            if (!res.ok) {
              toast.error("Greška", data.error || "Nije moguće ponovno otvoriti tiket")
              return
            }

            toast.success("Tiket ponovno otvoren", "Otvoreno od strane računovodstva")
          } catch (error) {
            toast.error("Greška", "Neuspjelo slanje zahtjeva")
          }
        })
      }
    >
      {pending ? "Otvaram..." : "Ponovno otvori"}
    </Button>
  )
}
