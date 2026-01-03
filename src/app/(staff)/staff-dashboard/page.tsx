import { Suspense } from "react"
import { StaffDashboard } from "@/components/staff/dashboard"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { LegacyBanner } from "@/components/layout/LegacyBanner"

export const dynamic = "force-dynamic"

export default function StaffDashboardPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <LegacyBanner message="Legacy dashboard. Use Control Center for client oversight." />
      <StaffDashboard />
    </Suspense>
  )
}
