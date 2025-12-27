import { Metadata } from "next"
import { notFound } from "next/navigation"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts, newsCategories, newsPostSources, newsItems } from "@/lib/db/schema"
import { eq, and, lte, desc } from "drizzle-orm"
import { ImageWithAttribution } from "@/components/news/ImageWithAttribution"
import { NewsMarkdown } from "@/components/news/NewsMarkdown"
import { PostCard } from "@/components/news/PostCard"
import { format } from "date-fns"
import { hr } from "date-fns/locale"
import Link from "next/link"
import { ExternalLink, Calendar, CheckCircle2, Wrench, Zap, AlertCircle } from "lucide-react"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ slug: string }>
}

// Helper function to extract structured data from content
// This parses markdown-style sections from the content
function extractStructuredSections(content: string) {
  const tldrMatch = content.match(/## TL;DR\s*\n([\s\S]*?)(?=\n## |\n#{1,2} |\Z)/i)
  const actionMatch = content.match(/## Što napraviti\s*\n([\s\S]*?)(?=\n## |\n#{1,2} |\Z)/i)
  const toolsMatch = content.match(/## Povezani alati\s*\n([\s\S]*?)(?=\n## |\n#{1,2} |\Z)/i)

  // Parse action items from markdown list
  const actionItems = actionMatch
    ? actionMatch[1]
        .split("\n")
        .filter((line) => line.trim().startsWith("-") || line.trim().startsWith("*"))
        .map((line) => line.replace(/^[\s-*]+/, "").trim())
    : null

  // Parse related tools from markdown links
  const relatedTools = toolsMatch
    ? Array.from(toolsMatch[1].matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)).map((match) => ({
        title: match[1],
        href: match[2],
      }))
    : null

  return {
    tldr: tldrMatch ? tldrMatch[1].trim() : null,
    actionItems,
    relatedTools,
  }
}

// TL;DR Section Component
function TLDRSection({ content }: { content: string }) {
  return (
    <div className="my-8 rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/20">
          <Zap className="h-5 w-5 text-blue-400" />
        </div>
        <div className="flex-1">
          <h2 className="mb-3 text-lg font-semibold text-blue-300">TL;DR — Brzi pregled</h2>
          <div className="text-sm leading-relaxed text-white/90">
            <NewsMarkdown content={content} />
          </div>
        </div>
      </div>
    </div>
  )
}

// Action Items Section Component
function ActionItemsSection({ items }: { items: string[] }) {
  return (
    <div className="my-8 rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-green-500/10 p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/20">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
        </div>
        <div className="flex-1">
          <h2 className="mb-4 text-lg font-semibold text-emerald-300">Što napraviti</h2>
          <ul className="space-y-2">
            {items.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm text-white/90">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// Related Tools Section Component
function RelatedToolsSection({ tools }: { tools: { title: string; href: string }[] }) {
  return (
    <div className="my-8 rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-500/20">
          <Wrench className="h-5 w-5 text-cyan-400" />
        </div>
        <div className="flex-1">
          <h2 className="mb-4 text-lg font-semibold text-cyan-300">Povezani alati</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {tools.map((tool, idx) => (
              <Link
                key={idx}
                href={tool.href}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                <Wrench className="h-4 w-4 text-cyan-400" />
                <span>{tool.title}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
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
  const { slug } = await params
  const post = await getPost(slug)

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
  const { slug } = await params
  const post = await getPost(slug)

  if (!post) {
    notFound()
  }

  const relatedPosts = await getRelatedPosts(post.categoryId, post.id)

  // Extract structured sections from content
  const sections = extractStructuredSections(post.content)

  // Remove structured sections from main content to avoid duplication
  let mainContent = post.content
  if (sections.tldr) {
    mainContent = mainContent.replace(/## TL;DR\s*\n[\s\S]*?(?=\n## |\n#{1,2} |\Z)/i, "")
  }
  if (sections.actionItems) {
    mainContent = mainContent.replace(/## Što napraviti\s*\n[\s\S]*?(?=\n## |\n#{1,2} |\Z)/i, "")
  }
  if (sections.relatedTools) {
    mainContent = mainContent.replace(/## Povezani alati\s*\n[\s\S]*?(?=\n## |\n#{1,2} |\Z)/i, "")
  }

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

        {/* TL;DR Section - Prominent at the top */}
        {sections.tldr && <TLDRSection content={sections.tldr} />}

        {/* Main Content */}
        <NewsMarkdown content={mainContent.trim()} />

        {/* Action Items Section */}
        {sections.actionItems && sections.actionItems.length > 0 && (
          <ActionItemsSection items={sections.actionItems} />
        )}

        {/* Related Tools Section */}
        {sections.relatedTools && sections.relatedTools.length > 0 && (
          <RelatedToolsSection tools={sections.relatedTools} />
        )}

        {/* Source Attribution - Enhanced */}
        {post.sources && post.sources.length > 0 && (
          <div className="my-8 rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-purple-500/20">
                <ExternalLink className="h-5 w-5 text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="mb-4 text-lg font-semibold text-purple-300">Izvori</h3>
                <div className="space-y-3">
                  {post.sources.map((source, idx) => (
                    <a
                      key={idx}
                      href={source.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-4 transition-all hover:border-purple-500/30 hover:bg-white/10"
                    >
                      <ExternalLink className="h-5 w-5 flex-shrink-0 text-purple-400" />
                      <div className="flex-1">
                        <p className="font-medium text-white">{source.originalTitle}</p>
                        <p className="mt-1 text-sm text-white/60">
                          {new URL(source.sourceUrl).hostname}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
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
