import { Suspense } from "react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { TicketsList } from "@/components/staff/tickets-list"

export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: Promise<{
    status?: string
    category?: string
    priority?: string
    client?: string
  }>
}

export default async function TicketsPage({ searchParams }: PageProps) {
  const params = await searchParams

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <TicketsList
        statusFilter={params.status}
        categoryFilter={params.category}
        priorityFilter={params.priority}
        clientFilter={params.client}
      />
    </Suspense>
  )
}
