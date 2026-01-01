"use client"

import { useTransition, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "@/lib/toast"

// Local types for support ticket enums (containment: removed @prisma/client import)
type SupportTicketPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT"
type TicketCategory = "TECHNICAL" | "BILLING" | "ACCOUNTING" | "GENERAL"

export function CreateSupportTicketForm() {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [priority, setPriority] = useState<SupportTicketPriority>("NORMAL")
  const [category, setCategory] = useState<TicketCategory>("GENERAL")
  const [pending, startTransition] = useTransition()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        const res = await fetch("/api/support/tickets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: title.trim(),
            body: body?.trim(),
            priority,
            category,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          toast.error("Greška", data.error || "Nije uspjelo kreiranje tiketa")
          return
        }

        toast.success("Tiket otvoren", "Računovođa će odgovoriti unutar aplikacije")
        setTitle("")
        setBody("")
        setPriority("NORMAL")
        setCategory("GENERAL")
      } catch {
        toast.error("Greška", "Nije uspjelo slanje zahtjeva")
      }
    })
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="title">Naslov</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Npr. Trebam pomoć oko PDV evidencije"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="body">Opis</Label>
        <textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Dodajte detalje i eventualne rokove..."
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="category">Kategorija</Label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as TicketCategory)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="GENERAL">Opće pitanje</option>
          <option value="TECHNICAL">Tehnički problem</option>
          <option value="BILLING">Naplata</option>
          <option value="ACCOUNTING">Računovodstvo</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="priority">Prioritet</Label>
        <select
          id="priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as SupportTicketPriority)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="LOW">Nizak</option>
          <option value="NORMAL">Standard</option>
          <option value="HIGH">Visok</option>
          <option value="URGENT">Hitno</option>
        </select>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Spremanje..." : "Otvori tiket"}
      </Button>
    </form>
  )
}
