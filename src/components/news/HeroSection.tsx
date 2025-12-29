import Link from "next/link"
import { ImageWithAttribution } from "./ImageWithAttribution"
import { formatDistanceToNow } from "date-fns"
import { hr } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { GlassCard } from "@/components/ui/patterns/GlassCard"
import { HoverScale } from "@/components/ui/motion/HoverScale"

interface HeroPost {
  slug: string
  title: string
  excerpt?: string | null
  categoryName?: string | null
  categorySlug?: string | null
  publishedAt: Date | null
  featuredImageUrl?: string | null
  featuredImageSource?: string | null
  impactLevel?: string | null
}

interface HeroSectionProps {
  featuredPost: HeroPost
  secondaryPosts: HeroPost[]
}

export function HeroSection({ featuredPost, secondaryPosts }: HeroSectionProps) {
  return (
    <section className="mb-12">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Featured Post - Takes 2 columns on large screens */}
        <FeaturedCard post={featuredPost} />

        {/* Secondary Posts - Stacked on right */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          {secondaryPosts.slice(0, 3).map((post) => (
            <SecondaryCard key={post.slug} post={post} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FeaturedCard({ post }: { post: HeroPost }) {
  return (
    <HoverScale className="lg:col-span-2">
      <Link href={`/vijesti/${post.slug}`} className="group block">
        <GlassCard hover={false} padding="none" className="overflow-hidden rounded-2xl">
          {/* Large Featured Image */}
          <div className="relative aspect-[21/9]">
            <ImageWithAttribution
              src={post.featuredImageUrl}
              source={post.featuredImageSource}
              alt={post.title}
              categorySlug={post.categorySlug}
              className="h-full w-full"
            />
            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            {/* Content Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6">
              {post.categoryName && (
                <Badge variant="category" className="mb-3">
                  {post.categoryName}
                </Badge>
              )}
              <h2 className="mb-2 text-3xl font-bold text-white group-hover:text-accent md:text-4xl">
                {post.title}
              </h2>
              {post.excerpt && (
                <p className="mb-3 line-clamp-2 text-base text-white/90">{post.excerpt}</p>
              )}
              {post.publishedAt && (
                <time dateTime={post.publishedAt.toISOString()} className="text-sm text-white/70">
                  {formatDistanceToNow(post.publishedAt, { addSuffix: true, locale: hr })}
                </time>
              )}
            </div>
          </div>
        </GlassCard>
      </Link>
    </HoverScale>
  )
}

function SecondaryCard({ post }: { post: HeroPost }) {
  return (
    <HoverScale>
      <Link href={`/vijesti/${post.slug}`} className="group block">
        <GlassCard hover={false} padding="none" className="overflow-hidden rounded-xl">
          <div className="flex gap-4 p-4">
            {/* Smaller Image */}
            <div className="relative h-24 w-32 flex-shrink-0 overflow-hidden rounded-lg">
              <ImageWithAttribution
                src={post.featuredImageUrl}
                source={post.featuredImageSource}
                alt={post.title}
                categorySlug={post.categorySlug}
                className="h-full w-full"
              />
            </div>

            {/* Content */}
            <div className="flex-1">
              {post.categoryName && (
                <Badge variant="category" size="sm" className="mb-1">
                  {post.categoryName}
                </Badge>
              )}
              <h3 className="mb-1 line-clamp-2 text-sm font-semibold text-white group-hover:text-accent">
                {post.title}
              </h3>
              {post.publishedAt && (
                <time dateTime={post.publishedAt.toISOString()} className="text-xs text-white/50">
                  {formatDistanceToNow(post.publishedAt, { addSuffix: true, locale: hr })}
                </time>
              )}
            </div>
          </div>
        </GlassCard>
      </Link>
    </HoverScale>
  )
}
