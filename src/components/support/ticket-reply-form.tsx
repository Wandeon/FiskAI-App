"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const router = useRouter()
  const [body, setBody] = useState("")
  const [pending, startTransition] = useTransition()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await fetch(`/api/support/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      })
      if (!res.ok) {
        toast.error("Ne mogu poslati poruku")
        return
      }
      setBody("")
      toast.success("Poruka poslana")
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Napišite odgovor ili tražene podatke..."
        rows={3}
        required
      />
      <Button type="submit" disabled={pending}>
        Pošalji odgovor
      </Button>
    </form>
  )
}
