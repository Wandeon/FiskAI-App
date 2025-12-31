import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface PageSkeletonProps {
  variant?: "list" | "form" | "detail" | "grid" | "settings"
  title?: boolean
  className?: string
}

/**
 * Reusable page-level skeleton component for loading states
 */
export function PageSkeleton({ variant = "list", title = true, className }: PageSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Page Header */}
      {title && (
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
      )}

      {/* Variant-specific content */}
      {variant === "list" && <ListContentSkeleton />}
      {variant === "form" && <FormContentSkeleton />}
      {variant === "detail" && <DetailContentSkeleton />}
      {variant === "grid" && <GridContentSkeleton />}
      {variant === "settings" && <SettingsContentSkeleton />}
    </div>
  )
}

function ListContentSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filters/Search */}
      <div className="flex gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-[var(--border)]">
        {/* Header */}
        <div className="grid grid-cols-5 gap-4 border-b border-[var(--border)] bg-[var(--surface-secondary)] p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-20" />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-5 gap-4 border-b border-[var(--border)] p-4 last:border-b-0"
          >
            {Array.from({ length: 5 }).map((_, j) => (
              <Skeleton key={j} className="h-5 w-full" />
            ))}
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

function FormContentSkeleton() {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="card p-6 space-y-6">
        {/* Form fields */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}

        {/* Textarea field */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-32 w-full" />
        </div>

        {/* Buttons */}
        <div className="flex gap-4 pt-4">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    </div>
  )
}

function DetailContentSkeleton() {
  return (
    <div className="space-y-6">
      {/* Info cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card p-6 space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-32" />
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="card p-6 space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex justify-between py-2 border-b border-[var(--border)] last:border-0"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          ))}
        </div>
      </div>

      {/* Related items */}
      <div className="card p-6 space-y-4">
        <Skeleton className="h-6 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-2">
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

function GridContentSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card p-6 space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SettingsContentSkeleton() {
  return (
    <div className="max-w-3xl space-y-8">
      {/* Settings sections */}
      {Array.from({ length: 3 }).map((_, sectionIndex) => (
        <div key={sectionIndex} className="card p-6 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>

          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-12 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// Specialized skeletons for common page types
export function InvoiceListSkeleton() {
  return <PageSkeleton variant="list" />
}

export function ExpenseListSkeleton() {
  return <PageSkeleton variant="list" />
}

export function ProductListSkeleton() {
  return <PageSkeleton variant="list" />
}

export function ContactListSkeleton() {
  return <PageSkeleton variant="list" />
}

export function FormPageSkeleton() {
  return <PageSkeleton variant="form" />
}

export function DetailPageSkeleton() {
  return <PageSkeleton variant="detail" />
}

export function SettingsPageSkeleton() {
  return <PageSkeleton variant="settings" />
}

export function GridPageSkeleton() {
  return <PageSkeleton variant="grid" />
}
