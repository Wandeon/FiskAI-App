import { Metadata } from "next"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts, newsCategories, newsPostSources, newsItems, newsSources } from "@/lib/db/schema"
import { eq, desc, and, lte, isNull, sql, isNotNull } from "drizzle-orm"
import { format } from "date-fns"
import { hr } from "date-fns/locale"
import { HeroSection } from "@/components/news/HeroSection"
import { CategorySection } from "@/components/news/CategorySection"
import { DigestBanner } from "@/components/news/DigestBanner"
import { TrendingUp, Calendar, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/primitives/button"
import { Badge } from "@/components/ui/primitives/badge"
import { GlassCard } from "@/components/ui/patterns/GlassCard"
import { GradientButton } from "@/components/ui/patterns/GradientButton"
import { FadeIn } from "@/components/ui/motion/FadeIn"
import { NewsSearch } from "@/components/news/NewsSearch"
import { NewsletterSignup } from "@/components/news/NewsletterSignup"
import { getUpcomingDeadlines } from "@/lib/deadlines/queries"

export const metadata: Metadata = {
  title: "Porezne Vijesti | FiskAI",
  description:
    "Najnovije vijesti iz Porezne uprave, Narodnih novina i FINA-e za hrvatske poduzetnike. Automatizirani sažeci relevantni za vaše poslovanje.",
  keywords: ["porezne vijesti", "porezna uprava", "narodne novine", "FINA", "hrvatska"],
}

export const dynamic = "force-dynamic"

interface PostWithCategory {
  id: string
  slug: string
  title: string
  excerpt: string | null
  categoryName: string | null
  categorySlug: string | null
  publishedAt: Date | null
  featuredImageUrl: string | null
  featuredImageSource: string | null
  impactLevel: string | null
}

interface LatestSourceItem {
  id: string
  sourceName: string | null
  sourceUrl: string
  title: string
  preview: string | null
  publishedAt: Date | null
  impactLevel: string | null
}

function toPreview(value: string | null | undefined, maxLen = 180) {
  if (!value) return null
  const stripped = value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!stripped) return null
  if (stripped.length <= maxLen) return stripped
  return (
    stripped
      .slice(0, maxLen)
      .replace(/\s+\S*$/, "")
      .trim() + "…"
  )
}

async function getFeaturedPosts(): Promise<PostWithCategory[]> {
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
        eq(newsPosts.status, "published"),
        eq(newsPosts.type, "individual"),
        lte(newsPosts.publishedAt, new Date())
      )
    )
    .orderBy(desc(newsPosts.publishedAt))
    .limit(4)

  return posts as PostWithCategory[]
}

async function getLatestItems(limit = 10): Promise<LatestSourceItem[]> {
  const items = await drizzleDb
    .select({
      id: newsItems.id,
      sourceName: newsSources.name,
      sourceUrl: newsItems.sourceUrl,
      title: newsItems.originalTitle,
      summaryHr: newsItems.summaryHr,
      originalContent: newsItems.originalContent,
      publishedAt: newsItems.publishedAt,
      impactLevel: newsItems.impactLevel,
    })
    .from(newsItems)
    .leftJoin(newsSources, eq(newsItems.sourceId, newsSources.id))
    .where(and(isNotNull(newsItems.publishedAt), lte(newsItems.publishedAt, new Date())))
    .orderBy(desc(newsItems.publishedAt))
    .limit(limit)

  return items.map((item: any) => ({
    id: item.id,
    sourceName: item.sourceName,
    sourceUrl: item.sourceUrl,
    title: item.title,
    preview: item.summaryHr || toPreview(item.originalContent),
    publishedAt: item.publishedAt,
    impactLevel: item.impactLevel,
  })) as LatestSourceItem[]
}

async function getSources() {
  return await drizzleDb
    .select({
      id: newsSources.id,
      name: newsSources.name,
      url: newsSources.url,
      isActive: newsSources.isActive,
    })
    .from(newsSources)
    .orderBy(desc(newsSources.isActive), newsSources.name)
}

async function getPopularPosts(limit = 5): Promise<PostWithCategory[]> {
  const impactOrder = sql<number>`CASE ${newsPosts.impactLevel} WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 3 END`

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
        eq(newsPosts.status, "published"),
        eq(newsPosts.type, "individual"),
        lte(newsPosts.publishedAt, new Date())
      )
    )
    .orderBy(impactOrder, desc(newsPosts.publishedAt))
    .limit(limit)

  return posts as PostWithCategory[]
}

async function getPostsByCategory(categorySlug: string): Promise<PostWithCategory[]> {
  // First get the category
  const category = await drizzleDb
    .select()
    .from(newsCategories)
    .where(eq(newsCategories.slug, categorySlug))
    .limit(1)

  if (category.length === 0) return []

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
        eq(newsPosts.status, "published"),
        eq(newsPosts.type, "individual"),
        eq(newsPosts.categoryId, category[0].id),
        lte(newsPosts.publishedAt, new Date())
      )
    )
    .orderBy(desc(newsPosts.publishedAt))
    .limit(3)

  return posts as PostWithCategory[]
}

async function getTodaysDigest() {
  const digest = await drizzleDb
    .select({
      id: newsPosts.id,
      slug: newsPosts.slug,
      title: newsPosts.title,
      publishedAt: newsPosts.publishedAt,
    })
    .from(newsPosts)
    .where(
      and(
        eq(newsPosts.status, "published"),
        eq(newsPosts.type, "digest"),
        lte(newsPosts.publishedAt, new Date())
      )
    )
    .orderBy(desc(newsPosts.publishedAt))
    .limit(1)

  const post = digest[0]
  if (!post) return null

  const countResult = await drizzleDb
    .select({ count: sql<number>`count(*)` })
    .from(newsPostSources)
    .where(eq(newsPostSources.postId, post.id))

  return {
    ...post,
    itemCount: Number(countResult[0]?.count || 0),
  }
}

async function getMainCategories() {
  const categories = await drizzleDb
    .select({
      id: newsCategories.id,
      slug: newsCategories.slug,
      nameHr: newsCategories.nameHr,
      icon: newsCategories.icon,
    })
    .from(newsCategories)
    .where(isNull(newsCategories.parentId))
    .orderBy(newsCategories.sortOrder)

  return categories
}

interface PageProps {
  searchParams?: Promise<{ q?: string }>
}

export default async function VijestiPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams
  const [
    featuredPosts,
    mainCategories,
    todaysDigest,
    popularPosts,
    upcomingDeadlines,
    latestItems,
    sources,
  ] = await Promise.all([
    getFeaturedPosts(),
    getMainCategories(),
    getTodaysDigest(),
    getPopularPosts(),
    getUpcomingDeadlines(45, undefined, 4),
    getLatestItems(),
    getSources(),
  ])

  // Get posts by main categories
  const categoriesWithPosts = await Promise.all(
    mainCategories.slice(0, 3).map(async (category) => ({
      category,
      posts: await getPostsByCategory(category.slug),
    }))
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      {/* Header */}
      <FadeIn>
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold text-white md:text-5xl">Porezne Vijesti</h1>
          <p className="mx-auto max-w-2xl text-lg text-white/60">
            Pratimo Poreznu upravu, Narodne novine, FINA-u i HGK. AI automatski filtrira i sažima
            vijesti relevantne za hrvatske poduzetnike.
          </p>
        </div>
      </FadeIn>

      {/* Hero Section */}
      {featuredPosts.length >= 4 ? (
        <HeroSection featuredPost={featuredPosts[0]} secondaryPosts={featuredPosts.slice(1, 4)} />
      ) : (
        <FadeIn delay={0.05}>
          <GlassCard hover={false} className="mb-12">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">
                  Uskoro: AI sažeci i tjedni digest
                </p>
                <p className="text-sm text-white/60">
                  Prikupljamo i pripremamo prve objave. U međuvremenu, istražite vodiče i alate —
                  najbrži put do jasnih odgovora.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <GradientButton href="/vodic" size="sm" showArrow>
                  Vodiči
                </GradientButton>
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/alati">Alati</Link>
                </Button>
              </div>
            </div>
          </GlassCard>
        </FadeIn>
      )}

      {/* Category Navigation Bar */}
      <FadeIn delay={0.1}>
        <GlassCard hover={false} padding="sm" className="mb-8">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/vijesti">
              <Button variant="primary" size="sm">
                Sve
              </Button>
            </Link>
            {mainCategories.map((category) => (
              <Link key={category.id} href={`/vijesti/kategorija/${category.slug}`}>
                <Button variant="ghost" size="sm">
                  {category.nameHr}
                </Button>
              </Link>
            ))}
            <div className="ml-auto flex-1 md:flex-initial md:min-w-[300px]">
              <NewsSearch initialQuery={resolvedSearchParams?.q} />
            </div>
          </div>
        </GlassCard>
      </FadeIn>

      {/* Daily Digest Banner */}
      {todaysDigest && (
        <DigestBanner
          date={todaysDigest.publishedAt || new Date()}
          itemCount={todaysDigest.itemCount}
          slug={todaysDigest.slug}
        />
      )}

      {/* Category Sections */}
      {categoriesWithPosts.map(({ category, posts }) => (
        <CategorySection
          key={category.id}
          categoryName={category.nameHr}
          categorySlug={category.slug}
          posts={posts}
          icon={category.icon ? <span>{category.icon}</span> : undefined}
        />
      ))}

      {featuredPosts.length === 0 && latestItems.length > 0 && (
        <FadeIn>
          <section className="mb-12">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Najnovije iz izvora</h2>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200"
              >
                Aktiviraj personalizirani digest <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <GlassCard hover={false} padding="sm">
              <ul className="divide-y divide-white/10">
                {latestItems.map((item) => (
                  <li key={item.id}>
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg px-3 py-3 transition-colors hover:bg-white/5"
                    >
                      <p className="text-sm font-medium text-white line-clamp-2">{item.title}</p>
                      {item.preview && (
                        <p className="mt-1 text-sm text-white/60 line-clamp-2">{item.preview}</p>
                      )}
                      <p className="mt-1 text-xs text-white/50">
                        {item.sourceName ?? "Izvor"}
                        {item.publishedAt
                          ? ` • ${format(item.publishedAt, "d. MMM", { locale: hr })}`
                          : ""}
                        {item.impactLevel ? ` • ${item.impactLevel}` : ""}
                      </p>
                    </a>
                  </li>
                ))}
              </ul>
            </GlassCard>
          </section>
        </FadeIn>
      )}

      {/* Sidebar Content (could be moved to a 2-column layout) */}
      <aside className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Popular Posts */}
        <FadeIn delay={0.2}>
          <GlassCard hover>
            <div className="mb-4 flex items-center gap-2">
              <Badge variant="tech" size="sm">
                <TrendingUp className="h-4 w-4" />
              </Badge>
              <h3 className="text-lg font-semibold text-white">Popularno</h3>
            </div>
            {popularPosts.length > 0 ? (
              <ul className="space-y-3">
                {popularPosts.map((post) => (
                  <li key={post.id}>
                    <Link
                      href={`/vijesti/${post.slug}`}
                      className="block rounded-lg px-2 py-1 transition-colors hover:bg-white/5"
                    >
                      <p className="text-sm font-medium text-white line-clamp-2">{post.title}</p>
                      <p className="mt-1 text-xs text-white/50">
                        {post.categoryName ?? "Vijesti"}
                        {post.publishedAt
                          ? ` • ${format(post.publishedAt, "d. MMM", { locale: hr })}`
                          : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-white/50">Nema dovoljno podataka još.</p>
            )}
            <div className="mt-4">
              <Link
                href="/vijesti"
                className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200"
              >
                Sve vijesti <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </GlassCard>
        </FadeIn>

        {/* Upcoming Deadlines */}
        <FadeIn delay={0.3}>
          <GlassCard hover>
            <div className="mb-4 flex items-center gap-2">
              <Badge variant="tech" size="sm">
                <Calendar className="h-4 w-4" />
              </Badge>
              <h3 className="text-lg font-semibold text-white">Nadolazeći rokovi</h3>
            </div>
            {upcomingDeadlines.length > 0 ? (
              <ul className="space-y-3">
                {upcomingDeadlines.map((deadline) => (
                  <li key={deadline.id} className="rounded-lg bg-white/5 px-3 py-2">
                    <p className="text-sm font-medium text-white line-clamp-2">{deadline.title}</p>
                    <p className="mt-1 text-xs text-white/50">
                      {format(new Date(deadline.deadlineDate), "d. MMM", { locale: hr })}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-white/50">Nema rokova u sljedećih 45 dana.</p>
            )}
            <div className="mt-4">
              <Link
                href="/alati/kalendar"
                className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200"
              >
                Otvori kalendar <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </GlassCard>
        </FadeIn>

        {/* Newsletter Signup */}
        <NewsletterSignup />
      </aside>

      {/* Sources Footer */}
      <GlassCard hover={false} className="mt-12">
        <h2 className="mb-4 text-lg font-semibold text-white">Izvori vijesti</h2>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {sources.length > 0 ? (
            sources
              .slice(0, 8)
              .map((source) => <SourceCard key={source.id} name={source.name} url={source.url} />)
          ) : (
            <>
              <SourceCard name="Porezna uprava" url="https://www.porezna-uprava.hr" />
              <SourceCard name="Narodne novine" url="https://narodne-novine.nn.hr" />
              <SourceCard name="FINA" url="https://www.fina.hr" />
              <SourceCard name="HGK" url="https://www.hgk.hr" />
            </>
          )}
        </div>
      </GlassCard>
    </div>
  )
}

function SourceCard({ name, url }: { name: string; url: string }) {
  return (
    <GlassCard hover className="text-center">
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        <p className="font-medium text-white">{name}</p>
        <p className="text-xs text-white/50">{new URL(url).hostname}</p>
      </a>
    </GlassCard>
  )
}
