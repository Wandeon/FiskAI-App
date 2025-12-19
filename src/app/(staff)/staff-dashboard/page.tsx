import { Suspense } from "react"
import { StaffDashboard } from "@/components/staff/dashboard"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

export const dynamic = "force-dynamic"

export default function StaffDashboardPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <StaffDashboard />
    </Suspense>
  )
}
