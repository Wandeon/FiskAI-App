import { Suspense } from "react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { InvitationsList } from "@/components/staff/invitations-list"

export const dynamic = "force-dynamic"

export default function InvitationsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <InvitationsList />
    </Suspense>
  )
}
