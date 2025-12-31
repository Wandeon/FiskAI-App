import { Suspense } from "react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { StaffManagement } from "@/components/admin/staff-management"

export const dynamic = "force-dynamic"

export default function StaffPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <StaffManagement />
    </Suspense>
  )
}
