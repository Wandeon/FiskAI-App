import { notFound } from "next/navigation"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { TicketPriorityBadge, TicketStatusBadge } from "@/components/support/ticket-status-badge"
import { TicketReplyForm } from "@/components/support/ticket-reply-form"
import { TicketStatusSelect } from "@/components/support/ticket-status-select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SupportTicketStatus } from "@prisma/client"
import { ClaimTicketButton } from "@/components/support/claim-ticket-button"

const dateFmt = (value: Date) => value.toLocaleString("hr-HR", { dateStyle: "short", timeStyle: "short" })

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const companyUser = await db.companyUser.findFirst({
    where: { userId: user.id!, companyId: company.id },
    select: { role: true },
  })
  const isAccountant = companyUser?.role === "ACCOUNTANT"

  const ticket = await db.supportTicket.findFirst({
    where: { id: params.id, companyId: company.id },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, body: true, createdAt: true, authorId: true },
      },
    },
  })

  if (!ticket) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Ticket #{ticket.id.slice(0, 6)}</p>
          <h1 className="text-2xl font-bold">{ticket.title}</h1>
          <p className="text-sm text-muted-foreground">
            Otvoreno {dateFmt(ticket.createdAt)} • Zadnja promjena {dateFmt(ticket.updatedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TicketPriorityBadge priority={ticket.priority} />
          <TicketStatusBadge status={ticket.status} />
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Razgovor</CardTitle>
            <CardDescription>Komunikacija ostaje unutar FiskAI</CardDescription>
          </div>
          {isAccountant && (
            <TicketStatusSelect ticketId={ticket.id} value={ticket.status as SupportTicketStatus} />
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {ticket.body && (
            <div className="rounded-lg bg-muted/60 p-4 text-sm text-foreground">
              {ticket.body}
            </div>
          )}

          <div className="space-y-3">
            {ticket.messages.map((message) => (
              <div key={message.id} className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  {dateFmt(message.createdAt)} • {message.authorId === ticket.createdById ? "Klijent" : "Računovođa/AI"}
                </p>
                <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">{message.body}</p>
              </div>
            ))}
            {ticket.messages.length === 0 && (
              <p className="text-sm text-muted-foreground">Još nema odgovora.</p>
            )}
          </div>

          <div className="pt-2">
            <TicketReplyForm ticketId={ticket.id} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
          {isAccountant && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Dodijeljeno: {ticket.assignedTo?.name || "nije dodijeljeno"}
              </p>
              <ClaimTicketButton ticketId={ticket.id} isAssigned={!!ticket.assignedToId} />
            </div>
          )}
