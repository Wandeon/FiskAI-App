import { Skeleton } from "@/components/ui/skeleton"

export function DashboardSkeleton() {
  return (
    <div
      className="space-y-6"
      role="status"
      aria-label="Učitavanje nadzorne ploče"
      aria-busy="true"
    >
      <span className="sr-only">Učitavanje...</span>
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Hero Banner Skeleton */}
          <div className="card p-6 space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>

          {/* Checklist Widget Skeleton */}
          <div className="card p-6 space-y-4">
            <Skeleton className="h-6 w-40" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          </div>

          {/* Today Actions Card Skeleton */}
          <div className="card p-6 space-y-6">
            <Skeleton className="h-6 w-48" />

            {/* Stats Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          </div>

          {/* Revenue Trend Card Skeleton */}
          <div className="card p-6 space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Fiscalization Status Skeleton */}
          <div className="card p-6 space-y-4">
            <Skeleton className="h-6 w-48" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>

          {/* Compliance Status Card Skeleton */}
          <div className="card p-6 space-y-4">
            <Skeleton className="h-6 w-40" />
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>

          {/* Paušalni Status Card Skeleton */}
          <div className="card p-6 space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          </div>

          {/* Deadline Countdown Skeleton */}
          <div className="card p-6 space-y-4">
            <Skeleton className="h-6 w-36" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          </div>

          {/* VAT Overview Card Skeleton */}
          <div className="card p-6 space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          </div>

          {/* Recent Activity Skeleton */}
          <div className="card p-6 space-y-4">
            <Skeleton className="h-6 w-36" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
