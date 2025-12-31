import { Suspense } from "react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ClientsList } from "@/components/staff/clients-list"

export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function ClientsPage({ searchParams }: PageProps) {
  const { q: searchQuery } = await searchParams

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ClientsList searchQuery={searchQuery} />
    </Suspense>
  )
}
