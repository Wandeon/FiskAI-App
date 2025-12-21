import { Skeleton } from "@/components/ui/skeleton"
import { CardSkeleton, CardGridSkeleton } from "@/components/skeletons/card-skeleton"

export default function AdminDashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
      </div>

      {/* Metrics Grid */}
      <CardGridSkeleton count={4} variant="stat" columns={4} />

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CardSkeleton variant="chart" />
        <CardSkeleton variant="chart" />
      </div>

      {/* Onboarding Funnel */}
      <div className="card p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Compliance Health */}
      <div className="grid gap-6 md:grid-cols-3">
        <CardSkeleton variant="stat" />
        <CardSkeleton variant="stat" />
        <CardSkeleton variant="stat" />
      </div>

      {/* Recent Activity */}
      <CardSkeleton variant="list" />
    </div>
  )
}
