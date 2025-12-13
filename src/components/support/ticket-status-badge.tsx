import { Badge } from "@/components/ui/badge"
import { SupportTicketPriority, SupportTicketStatus } from "@prisma/client"

export function TicketStatusBadge({
  status,
}: {
  status: SupportTicketStatus
}) {
  const style =
    status === "OPEN"
      ? "bg-blue-100 text-blue-700 border-blue-200"
      : status === "IN_PROGRESS"
        ? "bg-amber-100 text-amber-700 border-amber-200"
        : status === "RESOLVED"
          ? "bg-emerald-100 text-emerald-700 border-emerald-200"
          : "bg-slate-100 text-slate-700 border-slate-200"

  const labels: Record<SupportTicketStatus, string> = {
    OPEN: "Otvoreno",
    IN_PROGRESS: "U radu",
    RESOLVED: "Riješeno",
    CLOSED: "Zatvoreno",
  }

  return <Badge className={style}>{labels[status]}</Badge>
}

export function TicketPriorityBadge({
  priority,
}: {
  priority: SupportTicketPriority
}) {
  const style =
    priority === "URGENT"
      ? "bg-red-100 text-red-700 border-red-200"
      : priority === "HIGH"
        ? "bg-amber-100 text-amber-700 border-amber-200"
        : priority === "LOW"
          ? "bg-slate-100 text-slate-700 border-slate-200"
          : "bg-blue-100 text-blue-700 border-blue-200"

  const labels: Record<SupportTicketPriority, string> = {
    URGENT: "Hitno",
    HIGH: "Visoko",
    NORMAL: "Normalno",
    LOW: "Nisko",
  }

  return <Badge className={style}>{labels[priority]}</Badge>
}
