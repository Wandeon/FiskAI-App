"use client"

import { useTransition } from "react"
import { SupportTicketStatus } from "@prisma/client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

const labels: Record<SupportTicketStatus, string> = {
  OPEN: "Otvoreno",
  IN_PROGRESS: "U radu",
  RESOLVED: "Riješeno",
  CLOSED: "Zatvoreno",
}

export function TicketStatusSelect({
  ticketId,
  value,
}: {
  ticketId: string
  value: SupportTicketStatus
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const onChange = (status: SupportTicketStatus) => {
    startTransition(async () => {
      const res = await fetch(`/api/support/tickets/${ticketId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        toast.error("Ne mogu promijeniti status")
        return
      }
      toast.success("Status ažuriran")
      router.refresh()
    })
  }

  return (
    <Select
      defaultValue={value}
      onValueChange={(v) => onChange(v as SupportTicketStatus)}
      disabled={pending}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.values(SupportTicketStatus).map((status) => (
          <SelectItem key={status} value={status}>
            {labels[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
