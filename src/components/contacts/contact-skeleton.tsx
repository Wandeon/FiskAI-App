import { Skeleton } from "@/components/ui/skeleton"

export function ContactCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-start gap-4 p-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="border-t border-[var(--border)] px-4 py-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="border-t border-[var(--border)] px-4 py-3 bg-[var(--surface-secondary)]">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function ContactListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <ContactCardSkeleton key={i} />
      ))}
    </div>
  )
}
