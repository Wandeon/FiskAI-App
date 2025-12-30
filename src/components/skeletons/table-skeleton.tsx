import { Skeleton } from "@/components/ui/skeleton"

interface TableSkeletonProps {
  rows?: number
  columns?: number
  showHeader?: boolean
  showActions?: boolean
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
  showHeader = true,
  showActions = true,
}: TableSkeletonProps) {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-label="Učitavanje tablice"
      aria-busy="true"
    >
      <span className="sr-only">Učitavanje...</span>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-[var(--border)]">
        {/* Table Header */}
        <div
          className="grid gap-4 border-b border-[var(--border)] bg-[var(--surface-secondary)] p-4"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)${showActions ? " auto" : ""}` }}
        >
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-24" />
          ))}
          {showActions && <Skeleton className="h-4 w-16" />}
        </div>

        {/* Table Rows */}
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid gap-4 border-b border-[var(--border)] p-4 last:border-b-0"
            style={{ gridTemplateColumns: `repeat(${columns}, 1fr)${showActions ? " auto" : ""}` }}
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton key={colIndex} className="h-5 w-full" />
            ))}
            {showActions && (
              <div className="flex gap-2">
                <Skeleton className="h-8 w-8 rounded" />
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    </div>
  )
}
