/**
 * Queue Item Skeleton
 *
 * Loading skeleton placeholder for queue items.
 * Provides visual feedback while queue data is loading.
 *
 * @module components/capability
 * @since PHASE 4 - Visual Refinement
 */
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function QueueItemSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function QueueSectionSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <QueueItemSkeleton key={i} />
      ))}
    </div>
  )
}
