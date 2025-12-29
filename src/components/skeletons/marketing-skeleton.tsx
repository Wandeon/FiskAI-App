import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface MarketingSkeletonProps {
  variant?: "landing" | "article" | "list" | "tool" | "auth"
  className?: string
}

/**
 * Skeleton component for marketing pages
 */
export function MarketingSkeleton({
  variant = "landing",
  className,
}: MarketingSkeletonProps) {
  return (
    <div className={cn("min-h-screen", className)}>
      {variant === "landing" && <LandingPageSkeleton />}
      {variant === "article" && <ArticlePageSkeleton />}
      {variant === "list" && <ListPageSkeleton />}
      {variant === "tool" && <ToolPageSkeleton />}
      {variant === "auth" && <AuthPageSkeleton />}
    </div>
  )
}

function LandingPageSkeleton() {
  return (
    <div className="space-y-16 py-12">
      {/* Hero */}
      <div className="container max-w-6xl mx-auto text-center space-y-6 px-4">
        <Skeleton className="h-12 w-3/4 mx-auto" />
        <Skeleton className="h-6 w-2/3 mx-auto" />
        <Skeleton className="h-6 w-1/2 mx-auto" />
        <div className="flex justify-center gap-4 pt-4">
          <Skeleton className="h-12 w-36" />
          <Skeleton className="h-12 w-36" />
        </div>
      </div>

      {/* Features Grid */}
      <div className="container max-w-6xl mx-auto px-4">
        <div className="text-center space-y-4 mb-12">
          <Skeleton className="h-8 w-64 mx-auto" />
          <Skeleton className="h-4 w-96 mx-auto" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-6 space-y-4">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="container max-w-6xl mx-auto px-4 text-center space-y-6">
        <Skeleton className="h-10 w-1/2 mx-auto" />
        <Skeleton className="h-12 w-40 mx-auto" />
      </div>
    </div>
  )
}

function ArticlePageSkeleton() {
  return (
    <div className="container max-w-4xl mx-auto py-12 px-4 space-y-8">
      {/* Breadcrumb */}
      <div className="flex gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Title */}
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-3/4" />
      </div>

      {/* Meta */}
      <div className="flex gap-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-20" />
      </div>

      {/* Content */}
      <div className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />

        <Skeleton className="h-64 w-full my-8" />

        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />

        <Skeleton className="h-6 w-1/3 mt-8" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  )
}

function ListPageSkeleton() {
  return (
    <div className="container max-w-6xl mx-auto py-12 px-4 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-96" />
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* List items */}
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-6 flex gap-6">
            <Skeleton className="h-24 w-24 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex justify-center gap-2">
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-10 w-10" />
      </div>
    </div>
  )
}

function ToolPageSkeleton() {
  return (
    <div className="container max-w-4xl mx-auto py-12 px-4 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <Skeleton className="h-10 w-64 mx-auto" />
        <Skeleton className="h-5 w-96 mx-auto" />
      </div>

      {/* Tool Form */}
      <div className="card p-8 space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}

        <Skeleton className="h-12 w-full" />
      </div>

      {/* Results area */}
      <div className="card p-8 space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-40 w-full" />
      </div>

      {/* Info section */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  )
}

function AuthPageSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <Skeleton className="h-12 w-32 mx-auto" />
          <Skeleton className="h-6 w-48 mx-auto mt-4" />
        </div>

        {/* Form */}
        <div className="card p-8 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>

          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>

          <Skeleton className="h-12 w-full" />

          <div className="flex items-center gap-4">
            <Skeleton className="h-px flex-1" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-px flex-1" />
          </div>

          <Skeleton className="h-12 w-full" />
        </div>

        {/* Footer link */}
        <Skeleton className="h-4 w-48 mx-auto" />
      </div>
    </div>
  )
}

// Convenience exports
export function LandingPageSkeleton() {
  return <MarketingSkeleton variant="landing" />
}

export function ArticlePageSkeleton() {
  return <MarketingSkeleton variant="article" />
}

export function MarketingListSkeleton() {
  return <MarketingSkeleton variant="list" />
}

export function ToolSkeleton() {
  return <MarketingSkeleton variant="tool" />
}

export function AuthSkeleton() {
  return <MarketingSkeleton variant="auth" />
}
