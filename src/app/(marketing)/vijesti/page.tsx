import { Metadata } from "next"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts, newsCategories } from "@/lib/db/schema"
import { eq, desc, and, lte, isNull } from "drizzle-orm"
import { HeroSection } from "@/components/news/HeroSection"
import { CategorySection } from "@/components/news/CategorySection"
import { DigestBanner } from "@/components/news/DigestBanner"
import { Search, TrendingUp, Calendar } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/primitives/button"
import { Badge } from "@/components/ui/primitives/badge"
import { GlassCard } from "@/components/ui/patterns/GlassCard"
import { GradientButton } from "@/components/ui/patterns/GradientButton"
import { FadeIn } from "@/components/ui/motion/FadeIn"

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
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

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

  return digest[0] || null
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

export default async function VijestiPage() {
  const [featuredPosts, mainCategories, todaysDigest] = await Promise.all([
    getFeaturedPosts(),
    getMainCategories(),
    getTodaysDigest(),
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
      {featuredPosts.length >= 4 && (
        <HeroSection featuredPost={featuredPosts[0]} secondaryPosts={featuredPosts.slice(1, 4)} />
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
            <div className="ml-auto">
              <Button variant="secondary" size="sm">
                <Search className="h-4 w-4" />
                Pretraži
              </Button>
            </div>
          </div>
        </GlassCard>
      </FadeIn>

      {/* Daily Digest Banner */}
      {todaysDigest && (
        <DigestBanner
          date={todaysDigest.publishedAt || new Date()}
          itemCount={5}
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
            <p className="text-sm text-white/50">Uskoro...</p>
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
            <p className="text-sm text-white/50">Uskoro...</p>
          </GlassCard>
        </FadeIn>

        {/* Newsletter */}
        <FadeIn delay={0.4}>
          <GlassCard hover>
            <h3 className="mb-2 text-lg font-semibold text-white">Newsletter</h3>
            <p className="mb-4 text-sm text-white/60">
              Primajte najvažnije vijesti direktno na email
            </p>
            <GradientButton size="sm" className="w-full">
              Pretplati se
            </GradientButton>
          </GlassCard>
        </FadeIn>
      </aside>

      {/* Sources Footer */}
      <GlassCard hover={false} className="mt-12">
        <h2 className="mb-4 text-lg font-semibold text-white">Izvori vijesti</h2>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <SourceCard name="Porezna uprava" url="https://www.porezna-uprava.hr" />
          <SourceCard name="Narodne novine" url="https://narodne-novine.nn.hr" />
          <SourceCard name="FINA" url="https://www.fina.hr" />
          <SourceCard name="HGK" url="https://www.hgk.hr" />
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
