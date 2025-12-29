import { Suspense } from "react"
import { StaffCalendar } from "@/components/staff/calendar"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

export const dynamic = "force-dynamic"

export default function CalendarPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <StaffCalendar />
    </Suspense>
  )
}
