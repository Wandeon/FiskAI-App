import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TicketForm } from "@/components/support/ticket-form"
import { TicketPriorityBadge, TicketStatusBadge } from "@/components/support/ticket-status-badge"
import Link from "next/link"
import { KeyRound } from "lucide-react"

const dateFmt = (value: Date) => value.toLocaleString("hr-HR", { dateStyle: "short", timeStyle: "short" })

export default async function SupportPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const tickets = await db.supportTicket.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, body: true, createdAt: true },
      },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Podrška bez mailova</p>
        <h1 className="text-2xl font-bold">Ticketi prema računovodstvu</h1>
        <p className="text-muted-foreground">
          Vaš računovođa radi u FiskAI. Otvorite ticket, pratite status i odgovore – bez slanja CSV-ova ili mailova.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Otvoreni ticketi</CardTitle>
            <CardDescription>Stanje i zadnji odgovor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Još nema ticketa.</p>
            ) : (
              tickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/support/${ticket.id}`}
                  className="flex flex-col gap-2 rounded-lg border border-border p-4 transition hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">{ticket.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Otvoreno: {dateFmt(ticket.createdAt)}
                        {ticket.assignedTo && ` • Računovođa: ${ticket.assignedTo.name || ticket.assignedTo.email}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <TicketPriorityBadge priority={ticket.priority} />
                      <TicketStatusBadge status={ticket.status} />
                    </div>
                  </div>
                  {ticket.messages[0] && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {ticket.messages[0].body}
                    </p>
                  )}
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Otvorite novi ticket</CardTitle>
            <CardDescription>Računovođa i AI tim dobiju zadatak odmah</CardDescription>
          </CardHeader>
          <CardContent>
            <TicketForm />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" />
            Upravljaj računovođama
          </CardTitle>
          <CardDescription>Dodajte ili pregledajte računovođe koji rade u aplikaciji.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/settings/accountants" className="text-sm font-semibold text-primary hover:underline">
            Otvori upravljanje računovođama →
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
