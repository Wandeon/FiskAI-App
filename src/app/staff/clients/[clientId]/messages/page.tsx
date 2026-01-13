import { Suspense } from "react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { notFound, redirect } from "next/navigation"
import { StaffClientMessages } from "@/components/staff/client-messages"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

interface PageProps {
  params: Promise<{ clientId: string }>
}

async function getClientMessages(companyId: string) {
  const [company, tickets] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true },
    }),
    db.supportTicket.findMany({
      where: { companyId },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, body: true, createdAt: true, authorId: true },
        },
      },
    }),
  ])

  // Transform Date objects to ISO strings for client component
  const serializedTickets = tickets.map((ticket) => ({
    ...ticket,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    messages: ticket.messages.map((message) => ({
      ...message,
      createdAt: message.createdAt.toISOString(),
    })),
  }))

  return { company, tickets: serializedTickets }
}

export default async function ClientMessagesPage({ params }: PageProps) {
  const { clientId } = await params
  const session = await auth()

  if (!session?.user) {
    redirect("/auth")
  }

  const { company, tickets } = await getClientMessages(clientId)

  if (!company) {
    notFound()
  }

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <StaffClientMessages clientId={clientId} clientName={company.name} initialTickets={tickets} />
    </Suspense>
  )
}
