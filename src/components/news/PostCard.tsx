import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { hr } from "date-fns/locale"
import { ImageWithAttribution } from "./ImageWithAttribution"
import { cn } from "@/lib/utils"

interface PostCardProps {
  slug: string
  title: string
  excerpt?: string | null
  categoryName?: string | null
  categorySlug?: string | null
  publishedAt: Date | null
  featuredImageUrl?: string | null
  featuredImageSource?: string | null
  impactLevel?: string | null
  className?: string
}

const impactColors = {
  high: "bg-danger/20 text-red-300",
  medium: "bg-warning/20 text-yellow-300",
  low: "bg-success/20 text-green-300",
}

const impactLabels = {
  high: "Važno",
  medium: "Informativno",
  low: "FYI",
}

export function PostCard({
  slug,
  title,
  excerpt,
  categoryName,
  categorySlug,
  publishedAt,
  featuredImageUrl,
  featuredImageSource,
  impactLevel,
  className,
}: PostCardProps) {
  return (
    <Link href={`/vijesti/${slug}`} className={cn("group block", className)}>
      <article className="overflow-hidden rounded-xl border border-white/10 bg-surface/5 transition-all hover:border-white/20 hover:bg-surface/10">
        {/* Featured Image */}
        <div className="relative aspect-[16/9]">
          <ImageWithAttribution
            src={featuredImageUrl}
            source={featuredImageSource}
            alt={title}
            categorySlug={categorySlug}
            className="h-full w-full"
          />
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Category Badge */}
          <div className="mb-2 flex flex-wrap gap-2">
            {categoryName && (
              <span className="rounded-full bg-interactive/20 px-2 py-0.5 text-xs font-medium text-blue-300">
                {categoryName}
              </span>
            )}
            {impactLevel && impactLevel in impactColors && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  impactColors[impactLevel as keyof typeof impactColors]
                )}
              >
                {impactLabels[impactLevel as keyof typeof impactLabels]}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="mb-2 line-clamp-2 text-lg font-semibold text-white group-hover:text-link">
            {title}
          </h3>

          {/* Excerpt */}
          {excerpt && <p className="mb-3 line-clamp-3 text-sm text-white/70">{excerpt}</p>}

          {/* Published Date */}
          {publishedAt && (
            <time dateTime={publishedAt.toISOString()} className="text-xs text-white/50">
              {formatDistanceToNow(publishedAt, { addSuffix: true, locale: hr })}
            </time>
          )}
        </div>
      </article>
    </Link>
  )
}
