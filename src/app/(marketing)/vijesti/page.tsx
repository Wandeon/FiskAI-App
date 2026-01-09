import { Metadata } from "next"
import {
  getFeaturedPosts,
  getAllCategories,
  getPostsByCategory,
  getPopularPosts,
} from "@/lib/content/news"
import { format } from "date-fns"
import { hr } from "date-fns/locale"
import { HeroSection } from "@/components/news/HeroSection"
import { CategorySection } from "@/components/news/CategorySection"
import { TrendingUp, Calendar, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { GlassCard } from "@/components/ui/patterns/GlassCard"
import { GradientButton } from "@/components/ui/patterns/GradientButton"
import { FadeIn } from "@/components/ui/motion/FadeIn"
import { NewsSearch } from "@/components/news/NewsSearch"
import { NewsletterSignupStatic } from "@/components/news/NewsletterSignupStatic"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const metadata: Metadata = {
  title: "Porezne Vijesti | FiskAI",
  description: "Najnovije vijesti iz Porezne uprave, Narodnih novina i FINA-e.",
  alternates: { canonical: `${BASE_URL}/vijesti` },
}

// STATIC - No force-dynamic, updates via daily rebuild
export default async function VijestiPage() {
  const [featuredPosts, categories, popularPosts] = await Promise.all([
    getFeaturedPosts(4),
    getAllCategories(),
    getPopularPosts(5),
  ])

  const categoriesWithPosts = await Promise.all(
    categories.slice(0, 3).map(async (category) => ({
      category,
      posts: await getPostsByCategory(category.slug, 3),
    }))
  )

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      <FadeIn>
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold text-white md:text-5xl">Porezne Vijesti</h1>
          <p className="mx-auto max-w-2xl text-lg text-white/60">
            Pratimo Poreznu upravu, Narodne novine, FINA-u i HGK. AI automatski filtrira i sažima
            vijesti relevantne za hrvatske poduzetnike.
          </p>
        </div>
      </FadeIn>

      {featuredPosts.length >= 4 ? (
        <HeroSection
          featuredPost={{
            slug: featuredPosts[0].slug,
            title: featuredPosts[0].title,
            excerpt: featuredPosts[0].excerpt,
            categoryName: featuredPosts[0].categoryName,
            categorySlug: featuredPosts[0].categorySlug,
            publishedAt: featuredPosts[0].publishedAt
              ? new Date(featuredPosts[0].publishedAt)
              : null,
            featuredImageUrl: featuredPosts[0].featuredImageUrl,
            featuredImageSource: null,
            impactLevel: featuredPosts[0].impactLevel,
          }}
          secondaryPosts={featuredPosts.slice(1, 4).map((p) => ({
            slug: p.slug,
            title: p.title,
            excerpt: p.excerpt,
            categoryName: p.categoryName,
            categorySlug: p.categorySlug,
            publishedAt: p.publishedAt ? new Date(p.publishedAt) : null,
            featuredImageUrl: p.featuredImageUrl,
            featuredImageSource: null,
            impactLevel: p.impactLevel,
          }))}
        />
      ) : (
        <FadeIn delay={0.05}>
          <GlassCard hover={false} className="mb-12">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">
                  Uskoro: AI sažeci i tjedni digest
                </p>
                <p className="text-sm text-white/60">
                  Prikupljamo i pripremamo prve objave. U međuvremenu, istražite vodiče i alate.
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

      <FadeIn delay={0.1}>
        <GlassCard hover={false} padding="sm" className="mb-8">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/vijesti">
              <Button variant="primary" size="sm">
                Sve
              </Button>
            </Link>
            {categories.map((category) => (
              <Link key={category.id} href={`/vijesti/kategorija/${category.slug}`}>
                <Button variant="ghost" size="sm">
                  {category.name}
                </Button>
              </Link>
            ))}
            <div className="ml-auto flex-1 md:flex-initial md:min-w-[300px]">
              <NewsSearch />
            </div>
          </div>
        </GlassCard>
      </FadeIn>

      {categoriesWithPosts.map(({ category, posts }) => (
        <CategorySection
          key={category.id}
          categoryName={category.name}
          categorySlug={category.slug}
          posts={posts.map((p) => ({
            slug: p.slug,
            title: p.title,
            excerpt: p.excerpt,
            categoryName: p.categoryName,
            categorySlug: p.categorySlug,
            publishedAt: p.publishedAt ? new Date(p.publishedAt) : null,
            featuredImageUrl: p.featuredImageUrl,
            featuredImageSource: null,
            impactLevel: p.impactLevel,
          }))}
        />
      ))}

      <aside className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                      className="block rounded-lg px-2 py-1 transition-colors hover:bg-surface/5"
                    >
                      <p className="text-sm font-medium text-white line-clamp-2">{post.title}</p>
                      <p className="mt-1 text-xs text-white/50">
                        {post.categoryName ?? "Vijesti"}
                        {post.publishedAt &&
                          ` • ${format(new Date(post.publishedAt), "d. MMM", { locale: hr })}`}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-white/50">Nema dovoljno podataka još.</p>
            )}
          </GlassCard>
        </FadeIn>

        <FadeIn delay={0.3}>
          <GlassCard hover>
            <div className="mb-4 flex items-center gap-2">
              <Badge variant="tech" size="sm">
                <Calendar className="h-4 w-4" />
              </Badge>
              <h3 className="text-lg font-semibold text-white">Nadolazeći rokovi</h3>
            </div>
            <p className="text-sm text-white/50">Pogledajte kalendar rokova u aplikaciji.</p>
            <div className="mt-4">
              <a
                href="https://app.fiskai.hr/kalendar"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              >
                Otvori kalendar <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </GlassCard>
        </FadeIn>

        <NewsletterSignupStatic />
      </aside>
    </div>
  )
}
