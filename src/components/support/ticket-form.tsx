"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { SupportTicketPriority } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

export function TicketForm() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [priority, setPriority] = useState<SupportTicketPriority>("NORMAL")
  const [pending, startTransition] = useTransition()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, priority }),
      })

      if (!res.ok) {
        toast.error("Ne mogu poslati ticket")
        return
      }

      setTitle("")
      setBody("")
      setPriority("NORMAL")
      toast.success("Ticket poslan računovodstvu")
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Naslov</Label>
        <Input
          id="title"
          required
          minLength={3}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Npr. 'Ispravak PDV stope'"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="body">Detalji</Label>
        <Textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Kratko opišite što treba napraviti. Dodajte link na račun/trošak ako je relevantno."
          rows={4}
        />
      </div>
      <div className="space-y-2">
        <Label>Prioritet</Label>
        <Select
          value={priority}
          onValueChange={(v) => setPriority(v as SupportTicketPriority)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NORMAL">Normalno</SelectItem>
            <SelectItem value="HIGH">Visoko</SelectItem>
            <SelectItem value="URGENT">Hitno</SelectItem>
            <SelectItem value="LOW">Nisko</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        Pošalji ticket
      </Button>
    </form>
  )
}
