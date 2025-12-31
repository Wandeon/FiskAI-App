import { Suspense } from "react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { BulkOperations } from "@/components/staff/bulk-operations"

export const dynamic = "force-dynamic"

export default function BulkOperationsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <BulkOperations />
    </Suspense>
  )
}
