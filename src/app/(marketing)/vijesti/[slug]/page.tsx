import { Metadata } from "next"
import { notFound } from "next/navigation"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts, newsCategories, newsPostSources, newsItems } from "@/lib/db/schema"
import { eq, and, lte, desc } from "drizzle-orm"
import { ImageWithAttribution } from "@/components/news/ImageWithAttribution"
import { ViewTracker } from "@/components/news/ViewTracker"
import { NewsMarkdown } from "@/components/news/NewsMarkdown"
import { PostCard } from "@/components/news/PostCard"
import { JsonLd } from "@/components/seo/JsonLd"
import { generateNewsArticleSchema, generateBreadcrumbSchema } from "@/lib/schema/generators"
import { format } from "date-fns"
import { hr } from "date-fns/locale"
import Link from "next/link"
import { ExternalLink, Calendar, CheckCircle2, Wrench, Zap, Tag } from "lucide-react"
import { SocialShare } from "@/components/news/SocialShare"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ slug: string }>
}

// Helper function to extract structured data from content
function extractStructuredSections(content: string) {
  const tldrMatch = content.match(/## TL;DR\s*\n([\s\S]*?)(?=\n## |\n#{1,2} |\Z)/i)
  const actionMatch = content.match(/## Što napraviti\s*\n([\s\S]*?)(?=\n## |\n#{1,2} |\Z)/i)
  const toolsMatch = content.match(/## Povezani alati\s*\n([\s\S]*?)(?=\n## |\n#{1,2} |\Z)/i)

  const actionItems = actionMatch
    ? actionMatch[1]
        .split("\n")
        .filter((line) => line.trim().startsWith("-") || line.trim().startsWith("*"))
        .map((line) => line.replace(/^[\s-*]+/, "").trim())
    : null

  const relatedTools = toolsMatch
    ? Array.from(toolsMatch[1].matchAll(/\<a href=\"([^\"]+)\">([^<]+)<\/a>/g)).map((match) => ({
        title: match[2],
        href: match[1],
      }))
    : null

  return {
    tldr: tldrMatch ? tldrMatch[1].trim() : null,
    actionItems,
    relatedTools,
  }
}

function TLDRSection({ content }: { content: string }) {
  return (
    <div className="my-8 rounded-xl border border-info-border bg-gradient-to-br from-info-bg to-info-bg p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-info-bg">
          <Zap className="h-5 w-5 text-link" />
        </div>
        <div className="flex-1">
          <h2 className="mb-3 text-lg font-semibold text-info-text">TL;DR — Brzi pregled</h2>
          <div className="text-sm leading-relaxed text-foreground">
            <NewsMarkdown content={content} />
          </div>
        </div>
      </div>
    </div>
  )
}

function ActionItemsSection({ items }: { items: string[] }) {
  return (
    <div className="my-8 rounded-xl border border-success-border/20 bg-gradient-to-br from-success-bg/10 to-success-bg/10 p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-success-bg/20">
          <CheckCircle2 className="h-5 w-5 text-success-text" />
        </div>
        <div className="flex-1">
          <h2 className="mb-4 text-lg font-semibold text-success-text">Što napraviti</h2>
          <ul className="space-y-2">
            {items.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm text-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-text" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function RelatedToolsSection({ tools }: { tools: { title: string; href: string }[] }) {
  return (
    <div className="my-8 rounded-xl border border-info-border bg-gradient-to-br from-info-bg to-info-bg p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-interactive/20">
          <Wrench className="h-5 w-5 text-link" />
        </div>
        <div className="flex-1">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Povezani alati</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {tools.map((tool, idx) => (
              <Link
                key={idx}
                href={tool.href}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface/5 p-3 text-sm font-medium text-foreground transition-colors hover:bg-surface/10"
              >
                <Wrench className="h-4 w-4 text-link" />
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

  const url = `${BASE_URL}/vijesti/${slug}`

  return {
    title: post.title,
    description: post.excerpt || undefined,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "article",
      url,
      title: post.title,
      description: post.excerpt || undefined,
      siteName: "FiskAI",
      locale: "hr_HR",
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.publishedAt?.toISOString(),
      section: post.categoryName || "Vijesti",
      tags: post.tags as string[] | undefined,
      images: post.featuredImageUrl
        ? [
            {
              url: post.featuredImageUrl,
              width: 1200,
              height: 630,
              alt: post.title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
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
  const sections = extractStructuredSections(post.content)

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

  const articleUrl = `${BASE_URL}/vijesti/${slug}`
  const publishedDate = post.publishedAt?.toISOString() || new Date().toISOString()

  const breadcrumbItems = [
    { name: "Početna", url: BASE_URL },
    { name: "Vijesti", url: `${BASE_URL}/vijesti` },
    ...(post.categoryName
      ? [{ name: post.categoryName, url: `${BASE_URL}/vijesti/kategorija/${post.categorySlug}` }]
      : []),
    { name: post.title, url: articleUrl },
  ]

  return (
    <>
      <ViewTracker slug={slug} />
      <JsonLd
        schemas={[
          generateNewsArticleSchema(
            post.title,
            post.excerpt || "",
            publishedDate,
            publishedDate,
            articleUrl,
            post.featuredImageUrl || undefined
          ),
          generateBreadcrumbSchema(breadcrumbItems),
        ]}
      />

      <div className="mx-auto max-w-4xl px-4 py-12">
        <nav className="mb-6 text-sm text-muted">
          <Link href="/vijesti" className="hover:text-foreground">
            Vijesti
          </Link>
          {post.categoryName && (
            <>
              <span className="mx-2">/</span>
              <Link
                href={`/vijesti/kategorija/${post.categorySlug}`}
                className="hover:text-foreground"
              >
                {post.categoryName}
              </Link>
            </>
          )}
        </nav>

        <article>
          {post.categoryName && (
            <Link
              href={`/vijesti/kategorija/${post.categorySlug}`}
              className="mb-4 inline-block rounded-full bg-info-bg px-3 py-1 text-sm font-medium text-info-text transition-colors hover:bg-interactive/30"
            >
              {post.categoryName}
            </Link>
          )}

          <h1 className="mb-4 text-4xl font-bold text-foreground md:text-5xl">{post.title}</h1>

          <div className="mb-8 flex flex-wrap items-center gap-4 text-sm text-muted">
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
                    ? "bg-danger-bg text-danger-text"
                    : post.impactLevel === "medium"
                      ? "bg-warning-bg text-warning-text"
                      : "bg-success-bg text-success-text"
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

          <div className="mb-8">
            <SocialShare
              url={articleUrl}
              title={post.title}
              description={post.excerpt || undefined}
            />
          </div>

          {Array.isArray(post.tags) && (post.tags as string[]).length > 0 && (
            <div className="mb-8 flex flex-wrap items-center gap-2">
              <Tag className="h-4 w-4 text-muted" />
              {(post.tags as string[]).map((tag: string) => (
                <Link
                  key={tag}
                  href={`/vijesti/tag/${tag}`}
                  className="rounded-full bg-info-bg px-3 py-1 text-sm font-medium text-info-text transition-colors hover:bg-interactive/30"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}

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
                <p className="mt-2 text-sm italic text-muted">{post.featuredImageCaption}</p>
              )}
            </div>
          )}

          {sections.tldr && <TLDRSection content={sections.tldr} />}

          <NewsMarkdown content={mainContent.trim()} />

          {sections.actionItems && sections.actionItems.length > 0 && (
            <ActionItemsSection items={sections.actionItems} />
          )}

          {sections.relatedTools && sections.relatedTools.length > 0 && (
            <RelatedToolsSection tools={sections.relatedTools} />
          )}

          {post.sources && post.sources.length > 0 && (
            <div className="my-8 rounded-xl border border-chart-2/20 bg-gradient-to-br from-chart-2/10 to-chart-2/5 p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-chart-2/20">
                  <ExternalLink className="h-5 w-5 text-chart-2" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-4 text-lg font-semibold text-chart-2">Izvori</h3>
                  <div className="space-y-3">
                    {post.sources.map((source, idx) => (
                      <a
                        key={idx}
                        href={source.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 rounded-lg border border-border bg-surface/5 p-4 transition-all hover:border-chart-2/30 hover:bg-surface/10"
                      >
                        <ExternalLink className="h-5 w-5 flex-shrink-0 text-chart-2" />
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{source.originalTitle}</p>
                          <p className="mt-1 text-sm text-muted">
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

        {relatedPosts.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-6 text-2xl font-bold text-foreground">Srodne vijesti</h2>
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
    </>
  )
}
