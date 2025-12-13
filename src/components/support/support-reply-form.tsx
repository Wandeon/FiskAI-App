"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/lib/toast"

export function SupportReplyForm({ ticketId }: { ticketId: string }) {
  const [body, setBody] = useState("")
  const [pending, startTransition] = useTransition()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        const res = await fetch(`/api/support/tickets/${ticketId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            body: body.trim()
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          toast.error("Greška", data.error || "Poruka nije poslana")
          return
        }

        toast.success("Poruka poslana", "Odgovor primljen od računovodstva")
        setBody("")
      } catch (error) {
        toast.error("Greška", "Nije uspjelo slanje poruke")
      }
    })
  }

  return (
    <form className="space-y-2" onSubmit={onSubmit}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Upišite odgovor računovođi..."
        rows={4}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Slanje..." : "Pošalji odgovor"}
        </Button>
      </div>
    </form>
  )
}
