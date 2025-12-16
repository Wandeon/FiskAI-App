import { Metadata } from "next"
import { notFound } from "next/navigation"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts, newsCategories, newsPostSources, newsItems } from "@/lib/db/schema"
import { eq, and, lte, desc } from "drizzle-orm"
import { ImageWithAttribution } from "@/components/news/ImageWithAttribution"
import { PostCard } from "@/components/news/PostCard"
import { format } from "date-fns"
import { hr } from "date-fns/locale"
import Link from "next/link"
import { ExternalLink, Calendar, Tag } from "lucide-react"

export const dynamic = "force-dynamic"

interface PageProps {
  params: { slug: string }
}

async function getPost(slug: string) {
  const result = await drizzleDb
    .select({
      id: newsPosts.id,
      slug: newsPosts.slug,
      type: newsPosts.type,
      title: newsPosts.title,
      content: newsPosts.content,
      excerpt: newsPosts.excerpt,
      featuredImageUrl: newsPosts.featuredImageUrl,
      featuredImageSource: newsPosts.featuredImageSource,
      featuredImageCaption: newsPosts.featuredImageCaption,
      categoryId: newsPosts.categoryId,
      categoryName: newsCategories.nameHr,
      categorySlug: newsCategories.slug,
      categoryIcon: newsCategories.icon,
      categoryColor: newsCategories.color,
      tags: newsPosts.tags,
      impactLevel: newsPosts.impactLevel,
      publishedAt: newsPosts.publishedAt,
    })
    .from(newsPosts)
    .leftJoin(newsCategories, eq(newsPosts.categoryId, newsCategories.id))
    .where(
      and(
        eq(newsPosts.slug, slug),
        eq(newsPosts.status, "published"),
        lte(newsPosts.publishedAt, new Date())
      )
    )
    .limit(1)

  if (result.length === 0) return null

  // Get source items for attribution
  const sources = await drizzleDb
    .select({
      sourceUrl: newsItems.sourceUrl,
      originalTitle: newsItems.originalTitle,
      imageUrl: newsItems.imageUrl,
      imageSource: newsItems.imageSource,
    })
    .from(newsPostSources)
    .innerJoin(newsItems, eq(newsPostSources.newsItemId, newsItems.id))
    .where(eq(newsPostSources.postId, result[0].id))

  return {
    ...result[0],
    sources,
  }
}

async function getRelatedPosts(categoryId: string | null, currentPostId: string) {
  if (!categoryId) return []

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
    })
    .from(newsPosts)
    .leftJoin(newsCategories, eq(newsPosts.categoryId, newsCategories.id))
    .where(
      and(
        eq(newsPosts.categoryId, categoryId),
        eq(newsPosts.status, "published"),
        lte(newsPosts.publishedAt, new Date())
      )
    )
    .orderBy(desc(newsPosts.publishedAt))
    .limit(4)

  return posts.filter((p) => p.id !== currentPostId).slice(0, 3)
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const post = await getPost(params.slug)

  if (!post) {
    return {
      title: "Vijest nije pronađena | FiskAI",
    }
  }

  return {
    title: `${post.title} | FiskAI Vijesti`,
    description: post.excerpt || undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt || undefined,
      images: post.featuredImageUrl ? [post.featuredImageUrl] : undefined,
    },
  }
}

export default async function PostDetailPage({ params }: PageProps) {
  const post = await getPost(params.slug)

  if (!post) {
    notFound()
  }

  const relatedPosts = await getRelatedPosts(post.categoryId, post.id)

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-white/60">
        <Link href="/vijesti" className="hover:text-white">
          Vijesti
        </Link>
        {post.categoryName && (
          <>
            <span className="mx-2">/</span>
            <Link href={`/vijesti/kategorija/${post.categorySlug}`} className="hover:text-white">
              {post.categoryName}
            </Link>
          </>
        )}
      </nav>

      {/* Article Header */}
      <article>
        {/* Category Badge */}
        {post.categoryName && (
          <Link
            href={`/vijesti/kategorija/${post.categorySlug}`}
            className="mb-4 inline-block rounded-full bg-blue-500/20 px-3 py-1 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/30"
          >
            {post.categoryName}
          </Link>
        )}

        {/* Title */}
        <h1 className="mb-4 text-4xl font-bold text-white md:text-5xl">{post.title}</h1>

        {/* Meta Info */}
        <div className="mb-8 flex flex-wrap items-center gap-4 text-sm text-white/60">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <time dateTime={post.publishedAt?.toISOString()}>
              {post.publishedAt && format(post.publishedAt, "d. MMMM yyyy.", { locale: hr })}
            </time>
          </div>
          {post.impactLevel && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                post.impactLevel === "high"
                  ? "bg-red-500/20 text-red-300"
                  : post.impactLevel === "medium"
                    ? "bg-yellow-500/20 text-yellow-300"
                    : "bg-green-500/20 text-green-300"
              }`}
            >
              {post.impactLevel === "high"
                ? "Visok utjecaj"
                : post.impactLevel === "medium"
                  ? "Srednji utjecaj"
                  : "Nizak utjecaj"}
            </span>
          )}
        </div>

        {/* Featured Image */}
        {post.featuredImageUrl && (
          <div className="mb-8">
            <div className="relative aspect-[21/9] overflow-hidden rounded-xl">
              <ImageWithAttribution
                src={post.featuredImageUrl}
                source={post.featuredImageSource}
                alt={post.title}
                categorySlug={post.categorySlug || undefined}
                className="h-full w-full"
              />
            </div>
            {post.featuredImageCaption && (
              <p className="mt-2 text-sm italic text-white/60">{post.featuredImageCaption}</p>
            )}
          </div>
        )}

        {/* Content */}
        <div className="prose prose-invert max-w-none">
          <div
            className="text-white/90 leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: post.content
                .replace(/^### /gm, '<h3 class="text-2xl font-bold text-white mt-8 mb-4">')
                .replace(/^## /gm, '<h2 class="text-3xl font-bold text-white mt-10 mb-6">')
                .replace(/^# /gm, '<h1 class="text-4xl font-bold text-white mt-12 mb-6">')
                .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
                .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
                .replace(/\n\n/g, '</p><p class="mb-4">')
                .replace(/^(.+)$/gm, '<p class="mb-4">$1</p>')
                .replace(/- (.+)/g, '<li class="ml-4">$1</li>')
                .replace(/(<li.*<\/li>)/s, '<ul class="list-disc ml-6 mb-4">$1</ul>'),
            }}
          />
        </div>

        {/* Source Attribution */}
        {post.sources && post.sources.length > 0 && (
          <div className="mt-12 border-t border-white/10 pt-8">
            <h3 className="mb-4 text-lg font-semibold text-white">Izvori</h3>
            <div className="space-y-3">
              {post.sources.map((source, idx) => (
                <a
                  key={idx}
                  href={source.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10"
                >
                  <ExternalLink className="h-5 w-5 flex-shrink-0 text-blue-400" />
                  <div>
                    <p className="font-medium text-white">{source.originalTitle}</p>
                    <p className="mt-1 text-sm text-white/60">
                      {new URL(source.sourceUrl).hostname}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </article>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-2xl font-bold text-white">Srodne vijesti</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {relatedPosts.map((relatedPost) => (
              <PostCard
                key={relatedPost.id}
                slug={relatedPost.slug}
                title={relatedPost.title}
                excerpt={relatedPost.excerpt}
                categoryName={relatedPost.categoryName || undefined}
                categorySlug={relatedPost.categorySlug || undefined}
                publishedAt={relatedPost.publishedAt || new Date()}
                featuredImageUrl={relatedPost.featuredImageUrl}
                featuredImageSource={relatedPost.featuredImageSource}
                impactLevel={relatedPost.impactLevel}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
