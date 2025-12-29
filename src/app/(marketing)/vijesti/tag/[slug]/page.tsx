import { Metadata } from "next"
import { notFound } from "next/navigation"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts, newsCategories } from "@/lib/db/schema"
import { eq, desc, and, lte, sql } from "drizzle-orm"
import { PostCard } from "@/components/news/PostCard"
import { format } from "date-fns"
import { hr } from "date-fns/locale"
import Link from "next/link"
import { Tag, ArrowLeft } from "lucide-react"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ slug: string }>
}

async function getPostsByTag(tagSlug: string) {
  // Query posts that have this tag in their tags JSONB array
  const posts = await drizzleDb
    .select({
      id: newsPosts.id,
      slug: newsPosts.slug,
      title: newsPosts.title,
      excerpt: newsPosts.excerpt,
      categoryName: newsCategories.nameHr,
      categorySlug: newsCategories.slug,
      publishedAt: newsPosts.publishedAt,
      featuredImageUrl: newsPosts.featuredImageUrl,
      featuredImageSource: newsPosts.featuredImageSource,
      impactLevel: newsPosts.impactLevel,
      tags: newsPosts.tags,
    })
    .from(newsPosts)
    .leftJoin(newsCategories, eq(newsPosts.categoryId, newsCategories.id))
    .where(
      and(
        eq(newsPosts.status, "published"),
        lte(newsPosts.publishedAt, new Date()),
        sql`${newsPosts.tags}::jsonb @> ${JSON.stringify([tagSlug])}::jsonb`
      )
    )
    .orderBy(desc(newsPosts.publishedAt))
    .limit(50)

  return posts
}

async function getAllTags() {
  // Get all unique tags from published posts
  const result = await drizzleDb
    .select({
      tags: newsPosts.tags,
    })
    .from(newsPosts)
    .where(
      and(
        eq(newsPosts.status, "published"),
        lte(newsPosts.publishedAt, new Date())
      )
    )

  // Extract and count unique tags
  const tagCounts = new Map<string, number>()
  for (const row of result) {
    if (Array.isArray(row.tags)) {
      for (const tag of row.tags) {
        tagCounts.set(tag as string, (tagCounts.get(tag as string) || 0) + 1)
      }
    }
  }

  // Convert to array and sort by count
  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const posts = await getPostsByTag(slug)

  if (posts.length === 0) {
    return {
      title: "Oznaka nije pronađena | FiskAI",
    }
  }

  const url = `${BASE_URL}/vijesti/tag/${slug}`

  return {
    title: `#${slug} - Vijesti | FiskAI`,
    description: `Sve vijesti označene s #${slug}. Pronađeno ${posts.length} vijesti.`,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "website",
      url,
      title: `#${slug} - Vijesti | FiskAI`,
      description: `Sve vijesti označene s #${slug}. Pronađeno ${posts.length} vijesti.`,
      siteName: "FiskAI",
      locale: "hr_HR",
    },
  }
}

export default async function TagPage({ params }: PageProps) {
  const { slug } = await params
  const [posts, allTags] = await Promise.all([
    getPostsByTag(slug),
    getAllTags(),
  ])

  if (posts.length === 0) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/vijesti"
          className="mb-4 inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Natrag na vijesti
        </Link>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20">
            <Tag className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white md:text-4xl">#{slug}</h1>
            <p className="text-white/60">
              {posts.length} {posts.length === 1 ? "vijest" : "vijesti"}
            </p>
          </div>
        </div>
      </div>

      {/* Posts Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-12">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            slug={post.slug}
            title={post.title}
            excerpt={post.excerpt}
            categoryName={post.categoryName || undefined}
            categorySlug={post.categorySlug || undefined}
            publishedAt={post.publishedAt || new Date()}
            featuredImageUrl={post.featuredImageUrl}
            featuredImageSource={post.featuredImageSource}
            impactLevel={post.impactLevel}
          />
        ))}
      </div>

      {/* Related Tags */}
      {allTags.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 text-xl font-semibold text-white">Popularne oznake</h2>
          <div className="flex flex-wrap gap-2">
            {allTags.map(({ tag, count }) => (
              <Link
                key={tag}
                href={`/vijesti/tag/${tag}`}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  tag === slug
                    ? "bg-blue-500/30 text-blue-200"
                    : "bg-white/10 text-white/70 hover:bg-white/20"
                }`}
              >
                #{tag} ({count})
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
