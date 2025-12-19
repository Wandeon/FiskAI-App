import { Suspense } from "react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { TenantsList } from "@/components/admin/tenants-list"

export const dynamic = "force-dynamic"

export default async function AdminTenantsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <TenantsList />
    </Suspense>
  )
}
