import Link from "next/link"
import { ImageWithAttribution } from "./ImageWithAttribution"
import { formatDistanceToNow } from "date-fns"
import { hr } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface HeroPost {
  slug: string
  title: string
  excerpt?: string | null
  categoryName?: string
  categorySlug?: string
  publishedAt: Date
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
    <Link
      href={`/vijesti/${post.slug}`}
      className="group block overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-all hover:border-white/20 hover:bg-white/10 lg:col-span-2"
    >
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
            <span className="mb-3 inline-block rounded-full bg-blue-500/90 px-3 py-1 text-sm font-medium text-white">
              {post.categoryName}
            </span>
          )}
          <h2 className="mb-2 text-3xl font-bold text-white group-hover:text-blue-400 md:text-4xl">
            {post.title}
          </h2>
          {post.excerpt && (
            <p className="mb-3 line-clamp-2 text-base text-white/90">{post.excerpt}</p>
          )}
          <time dateTime={post.publishedAt.toISOString()} className="text-sm text-white/70">
            {formatDistanceToNow(post.publishedAt, { addSuffix: true, locale: hr })}
          </time>
        </div>
      </div>
    </Link>
  )
}

function SecondaryCard({ post }: { post: HeroPost }) {
  return (
    <Link
      href={`/vijesti/${post.slug}`}
      className="group block overflow-hidden rounded-xl border border-white/10 bg-white/5 transition-all hover:border-white/20 hover:bg-white/10"
    >
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
            <span className="mb-1 inline-block rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-300">
              {post.categoryName}
            </span>
          )}
          <h3 className="mb-1 line-clamp-2 text-sm font-semibold text-white group-hover:text-blue-400">
            {post.title}
          </h3>
          <time dateTime={post.publishedAt.toISOString()} className="text-xs text-white/50">
            {formatDistanceToNow(post.publishedAt, { addSuffix: true, locale: hr })}
          </time>
        </div>
      </div>
    </Link>
  )
}
