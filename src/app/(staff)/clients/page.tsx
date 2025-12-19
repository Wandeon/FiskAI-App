import { Suspense } from "react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ClientsList } from "@/components/staff/clients-list"

export const dynamic = "force-dynamic"

export default function ClientsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ClientsList />
    </Suspense>
  )
}
