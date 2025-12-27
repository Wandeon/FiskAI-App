import { redirect } from "next/navigation"
import Link from "next/link"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { SupportTicketPriority, SupportTicketStatus } from "@prisma/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SupportReplyForm } from "@/components/support/support-reply-form"
import { AssignSupportTicketButton } from "@/components/support/support-assign-button"
import {
  CloseSupportTicketButton,
  ReopenSupportTicketButton,
} from "@/components/support/support-status-buttons"

type PageProps = {
  params: Promise<{ id: string }>
}

const statusLabels: Record<SupportTicketStatus, string> = {
  OPEN: "Otvoren",
  IN_PROGRESS: "U tijeku",
  RESOLVED: "Riješen",
  CLOSED: "Zatvoren",
}

const priorityLabels: Record<SupportTicketPriority, string> = {
  LOW: "Nizak prioritet",
  NORMAL: "Standard",
  HIGH: "Visok",
  URGENT: "Hitno",
}

export default async function SupportDetailPage({ params }: PageProps) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const { id } = await params

  const ticket = await db.supportTicket.findFirst({
    where: { id, companyId: company.id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  })

  // Fetch user data for creator and assignee (no relations in schema)
  const [createdByUser, assignedToUser] = await Promise.all([
    ticket?.createdById
      ? db.user.findUnique({
          where: { id: ticket.createdById },
          select: { name: true, email: true },
        })
      : null,
    ticket?.assignedToId
      ? db.user.findUnique({
          where: { id: ticket.assignedToId },
          select: { name: true, email: true, id: true },
        })
      : null,
  ])

  // Fetch authors for messages
  const authorIds =
    ticket?.messages.map((m) => m.authorId).filter((id): id is string => id !== null) || []
  const uniqueAuthorIds = [...new Set(authorIds)]
  const authors =
    uniqueAuthorIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: uniqueAuthorIds } },
          select: { id: true, name: true, email: true },
        })
      : []
  const authorMap = new Map(authors.map((a) => [a.id, a]))

  if (!ticket) {
    redirect("/support")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/support" className="hover:text-foreground">
            Support
          </Link>
          <span>/</span>
          <span>{ticket.title}</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">{ticket.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary">{statusLabels[ticket.status]}</Badge>
          <Badge variant="outline">{priorityLabels[ticket.priority]}</Badge>
          <span className="text-muted-foreground">
            Kreirao: {createdByUser?.name || createdByUser?.email || "—"}
          </span>
          <span className="text-muted-foreground">
            Dodijeljeno: {assignedToUser?.name || assignedToUser?.email || "Nije dodijeljeno"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <AssignSupportTicketButton
            ticketId={ticket.id}
            currentAssigneeId={assignedToUser?.id || null}
            currentUserId={user.id!}
          />
          {ticket.status === "CLOSED" || ticket.status === "RESOLVED" ? (
            <ReopenSupportTicketButton ticketId={ticket.id} />
          ) : (
            <CloseSupportTicketButton ticketId={ticket.id} />
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Poruke</CardTitle>
          <CardDescription>Razgovor ostaje unutar aplikacije.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ticket.messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Još nema poruka.</p>
          ) : (
            <div className="space-y-3">
              {ticket.messages.map((message) => {
                const author = message.authorId ? authorMap.get(message.authorId) : null
                return (
                  <div
                    key={message.id}
                    className="rounded-xl border border-border bg-muted/40 px-3 py-2"
                  >
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{author?.name || author?.email || "Nepoznato"}</span>
                      <span>{message.createdAt.toLocaleString("hr-HR")}</span>
                    </div>
                    <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
                      {message.body}
                    </p>
                  </div>
                )
              })}
            </div>
          )}

          <SupportReplyForm ticketId={ticket.id} />
        </CardContent>
      </Card>
    </div>
  )
}
