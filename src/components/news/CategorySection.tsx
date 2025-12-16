import Link from "next/link"
import { PostCard } from "./PostCard"
import { ChevronRight } from "lucide-react"

interface CategoryPost {
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

interface CategorySectionProps {
  categoryName: string
  categorySlug: string
  posts: CategoryPost[]
  icon?: React.ReactNode
}

export function CategorySection({ categoryName, categorySlug, posts, icon }: CategorySectionProps) {
  if (posts.length === 0) return null

  return (
    <section className="mb-12">
      {/* Section Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-2xl">{icon}</span>}
          <h2 className="text-2xl font-bold text-white">{categoryName}</h2>
        </div>
        <Link
          href={`/vijesti/kategorija/${categorySlug}`}
          className="flex items-center gap-1 text-sm font-medium text-blue-400 transition-colors hover:text-blue-300"
        >
          Vidi sve
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Posts Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {posts.slice(0, 3).map((post) => (
          <PostCard
            key={post.slug}
            slug={post.slug}
            title={post.title}
            excerpt={post.excerpt}
            categoryName={post.categoryName}
            categorySlug={post.categorySlug}
            publishedAt={post.publishedAt}
            featuredImageUrl={post.featuredImageUrl}
            featuredImageSource={post.featuredImageSource}
            impactLevel={post.impactLevel}
          />
        ))}
      </div>
    </section>
  )
}
