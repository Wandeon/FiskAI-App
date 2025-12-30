import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface CardSkeletonProps {
  variant?: "default" | "stat" | "list" | "chart"
  className?: string
}

export function CardSkeleton({ variant = "default", className }: CardSkeletonProps) {
  if (variant === "stat") {
    return (
      <div
        className={cn("card p-6 space-y-3", className)}
        role="status"
        aria-label="Učitavanje statistike"
        aria-busy="true"
      >
        <span className="sr-only">Učitavanje...</span>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    )
  }

  if (variant === "list") {
    return (
      <div
        className={cn("card p-6 space-y-4", className)}
        role="status"
        aria-label="Učitavanje popisa"
        aria-busy="true"
      >
        <span className="sr-only">Učitavanje...</span>
        <Skeleton className="h-6 w-40" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
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
    )
  }

  if (variant === "chart") {
    return (
      <div
        className={cn("card p-6 space-y-4", className)}
        role="status"
        aria-label="Učitavanje grafikona"
        aria-busy="true"
      >
        <span className="sr-only">Učitavanje...</span>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="h-64 w-full" />
        <div className="flex justify-center gap-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    )
  }

  // Default variant
  return (
    <div
      className={cn("card p-6 space-y-4", className)}
      role="status"
      aria-label="Učitavanje kartice"
      aria-busy="true"
    >
      <span className="sr-only">Učitavanje...</span>
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <div className="flex gap-3 pt-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  )
}

interface CardGridSkeletonProps {
  count?: number
  variant?: "default" | "stat" | "list" | "chart"
  columns?: 2 | 3 | 4
}

export function CardGridSkeleton({
  count = 4,
  variant = "default",
  columns = 4,
}: CardGridSkeletonProps) {
  const gridColsClass = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-2 lg:grid-cols-3",
    4: "md:grid-cols-2 lg:grid-cols-4",
  }[columns]

  return (
    <div
      className={cn("grid gap-6", gridColsClass)}
      role="status"
      aria-label="Učitavanje kartica"
      aria-busy="true"
    >
      <span className="sr-only">Učitavanje...</span>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} variant={variant} />
      ))}
    </div>
  )
}
