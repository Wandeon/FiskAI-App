import Link from "next/link"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { SupportTicketStatus, SupportTicketPriority } from "@prisma/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { CreateSupportTicketForm } from "@/components/support/create-support-ticket-form"
import { MessageCircle } from "lucide-react"

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

export default async function SupportPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const tickets = await db.supportTicket.findMany({
    where: { companyId: company.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      updatedAt: true,
      assignedToId: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, authorId: true },
      },
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Podrška — radite s računovođom unutar aplikacije
        </p>
        <h1 className="text-2xl font-bold">Support</h1>
        <p className="text-muted-foreground">
          Otvorite tikete, pratite statuse i komunicirajte s računovođom bez izvoza podataka.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Tiketi</CardTitle>
              <CardDescription>Otvoreni i nedavno ažurirani tiketi (max 50)</CardDescription>
            </div>
            <Badge variant="secondary">{tickets.length} stavki</Badge>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {tickets.length === 0 ? (
              <EmptyState
                icon={<MessageCircle className="h-8 w-8" />}
                title="Još nema otvorenih tiketa"
                description="Koristite obrazac desno za komunikaciju s računovođom. Vaši tiketi i odgovori bit će prikazani ovdje."
                className="py-8"
              />
            ) : (
              tickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/support/${ticket.id}`}
                  className="flex flex-col gap-2 px-6 py-4 hover:bg-muted/40"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{ticket.title}</p>
                    <Badge variant="outline">{statusLabels[ticket.status]}</Badge>
                    <Badge variant="secondary">{priorityLabels[ticket.priority]}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>Zadnje ažurirano: {ticket.updatedAt.toLocaleString("hr-HR")}</span>
                    <span>Assign: {ticket.assignedToId || "Nije dodijeljeno"}</span>
                    {ticket.messages[0] && (
                      <span>Zadnja poruka: {ticket.messages[0].authorId || "—"}</span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Novi tiket</CardTitle>
            <CardDescription>Pošaljite upit ili zamolbu svojem računovođi.</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateSupportTicketForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
