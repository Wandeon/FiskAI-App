import type { MetadataRoute } from "next"
import {
  getSitemapRoutes,
  getCanonicalBaseUrl,
  isProductionSitemap,
  type Locale,
} from "@/config/routes"
import {
  getGuideSlugs,
  getAllComparisonSlugs,
  getGlossarySlugs,
  getHowToSlugs,
} from "@/lib/knowledge-hub/mdx"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts, newsCategories } from "@/lib/db/schema"
import { eq, lte, and, isNull } from "drizzle-orm"

// Force dynamic rendering - sitemap requires database access which isn't
// available during static build. This ensures the route is only executed
// at runtime when the database connection is available.
export const dynamic = "force-dynamic"

/**
 * Enterprise Sitemap Generator
 *
 * Features:
 * - Static routes from centralized registry
 * - Dynamic MDX content (guides, comparisons, glossary, how-tos)
 * - Database-driven news posts and categories
 * - Includes hreflang alternates for i18n
 * - Environment-safe (won't index staging/dev)
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getCanonicalBaseUrl()

  // Safety: Don't generate sitemap for non-production environments
  if (!isProductionSitemap() || !baseUrl) {
    return []
  }

  const now = new Date()
  const locales: Locale[] = ["hr", "en"]

  // =========================================================================
  // 1. Static routes from registry
  // =========================================================================
  const sitemapRoutes = getSitemapRoutes()

  const staticEntries: MetadataRoute.Sitemap = sitemapRoutes.flatMap(([, routeDef]) => {
    return locales.map((locale) => ({
      url: `${baseUrl}${routeDef.path[locale]}`,
      lastModified: now,
      changeFrequency: routeDef.changeFreq,
      priority: routeDef.priority,
      alternates: {
        languages: Object.fromEntries(
          locales.map((l) => [l, `${baseUrl}${routeDef.path[l]}`])
        ) as Record<Locale, string>,
      },
    }))
  })

  // =========================================================================
  // 2. Dynamic MDX content
  // =========================================================================

  // Guides (/vodic/[slug])
  const guideSlugs = getGuideSlugs()
  const guideEntries: MetadataRoute.Sitemap = guideSlugs.map((slug) => ({
    url: `${baseUrl}/vodic/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.7,
    alternates: {
      languages: {
        hr: `${baseUrl}/vodic/${slug}`,
        en: `${baseUrl}/en/guide/${slug}`,
      },
    },
  }))

  // Comparisons (/usporedba/[slug])
  const comparisonSlugs = await getAllComparisonSlugs()
  const comparisonEntries: MetadataRoute.Sitemap = comparisonSlugs.map((slug) => ({
    url: `${baseUrl}/usporedba/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.7,
    alternates: {
      languages: {
        hr: `${baseUrl}/usporedba/${slug}`,
        en: `${baseUrl}/en/comparison/${slug}`,
      },
    },
  }))

  // Glossary (/rjecnik/[pojam])
  const glossarySlugs = getGlossarySlugs()
  const glossaryEntries: MetadataRoute.Sitemap = glossarySlugs.map((slug) => ({
    url: `${baseUrl}/rjecnik/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
    alternates: {
      languages: {
        hr: `${baseUrl}/rjecnik/${slug}`,
        en: `${baseUrl}/en/glossary/${slug}`,
      },
    },
  }))

  // How-Tos (/kako-da/[slug])
  const howToSlugs = getHowToSlugs()
  const howToEntries: MetadataRoute.Sitemap = howToSlugs.map((slug) => ({
    url: `${baseUrl}/kako-da/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
    alternates: {
      languages: {
        hr: `${baseUrl}/kako-da/${slug}`,
        en: `${baseUrl}/en/how-to/${slug}`,
      },
    },
  }))

  // =========================================================================
  // 3. News from database (with error handling for build safety)
  // =========================================================================

  let newsEntries: MetadataRoute.Sitemap = []
  let categoryEntries: MetadataRoute.Sitemap = []

  try {
    // Published news posts (/vijesti/[slug])
    const publishedPosts = await drizzleDb
      .select({
        slug: newsPosts.slug,
        updatedAt: newsPosts.updatedAt,
        publishedAt: newsPosts.publishedAt,
      })
      .from(newsPosts)
      .where(and(eq(newsPosts.status, "published"), lte(newsPosts.publishedAt, now)))
      .limit(5000) // Reasonable limit for sitemap

    newsEntries = publishedPosts.map((post) => ({
      url: `${baseUrl}/vijesti/${post.slug}`,
      lastModified: post.updatedAt || post.publishedAt || now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
      alternates: {
        languages: {
          hr: `${baseUrl}/vijesti/${post.slug}`,
          en: `${baseUrl}/en/news/${post.slug}`,
        },
      },
    }))

    // News categories (/vijesti/kategorija/[slug])
    const categories = await drizzleDb
      .select({
        slug: newsCategories.slug,
      })
      .from(newsCategories)
      .where(isNull(newsCategories.parentId)) // Only main categories

    categoryEntries = categories.map((cat) => ({
      url: `${baseUrl}/vijesti/kategorija/${cat.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
      alternates: {
        languages: {
          hr: `${baseUrl}/vijesti/kategorija/${cat.slug}`,
          en: `${baseUrl}/en/news/category/${cat.slug}`,
        },
      },
    }))
  } catch (error) {
    // Database unavailable - skip news entries but continue with static content
    console.warn("[Sitemap] Database unavailable, skipping news entries:", error)
  }

  // =========================================================================
  // 4. Combine all entries
  // =========================================================================
  return [
    ...staticEntries,
    ...guideEntries,
    ...comparisonEntries,
    ...glossaryEntries,
    ...howToEntries,
    ...newsEntries,
    ...categoryEntries,
  ]
}
