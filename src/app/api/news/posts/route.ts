import { NextRequest, NextResponse } from "next/server"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts, newsCategories, newsItems, newsSources } from "@/lib/db/schema/news"
import { eq, desc, and, sql, lte, or, ilike, isNotNull } from "drizzle-orm"

export const dynamic = "force-dynamic"

/**
 * GET /api/news/posts
 *
 * Returns published posts only (status='published' and published_at <= now)
 *
 * Query parameters:
 * - category: filter by category slug
 * - type: filter by type ('individual' | 'digest')
 * - limit: number of results (default: 20, max: 50)
 * - offset: pagination offset (default: 0)
 * - q: search query (min 2 characters, searches title and excerpt)
 * - includeItems: if "true", also search newsItems table (source items)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Parse and validate parameters
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50)
    const offset = parseInt(searchParams.get("offset") || "0", 10)
    const categorySlug = searchParams.get("category") || undefined
    const type = searchParams.get("type") || undefined
    const query = searchParams.get("q")?.trim() || undefined
    const includeItems = searchParams.get("includeItems") === "true"

    // Build query conditions - only published posts
    const conditions = [eq(newsPosts.status, "published"), lte(newsPosts.publishedAt, new Date())]

    // Add type filter if provided
    if (type === "individual" || type === "digest") {
      conditions.push(eq(newsPosts.type, type))
    }

    // Add search filter if provided
    if (query && query.length >= 2) {
      const searchPattern = `%${query}%`
      conditions.push(
        or(ilike(newsPosts.title, searchPattern), ilike(newsPosts.excerpt, searchPattern))!
      )
    }

    // Add category filter if provided
    if (categorySlug) {
      // Join with categories to filter by slug
      const category = await drizzleDb
        .select()
        .from(newsCategories)
        .where(eq(newsCategories.slug, categorySlug))
        .limit(1)

      if (category.length > 0) {
        conditions.push(eq(newsPosts.categoryId, category[0].id))
      } else {
        // Category not found, return empty result
        return NextResponse.json({
          posts: [],
          items: [],
          count: 0,
          limit,
          offset,
        })
      }
    }

    // Execute query with category join
    const posts = await drizzleDb
      .select({
        id: newsPosts.id,
        slug: newsPosts.slug,
        type: newsPosts.type,
        title: newsPosts.title,
        excerpt: newsPosts.excerpt,
        categoryId: newsPosts.categoryId,
        categoryName: newsCategories.nameHr,
        categorySlug: newsCategories.slug,
        featuredImageUrl: newsPosts.featuredImageUrl,
        featuredImageSource: newsPosts.featuredImageSource,
        impactLevel: newsPosts.impactLevel,
        publishedAt: newsPosts.publishedAt,
      })
      .from(newsPosts)
      .leftJoin(newsCategories, eq(newsPosts.categoryId, newsCategories.id))
      .where(and(...conditions))
      .orderBy(desc(newsPosts.publishedAt))
      .limit(limit)
      .offset(offset)

    // Get total count with same filters
    const countResult = await drizzleDb
      .select({ count: sql<number>`count(*)` })
      .from(newsPosts)
      .where(and(...conditions))

    const postCount = Number(countResult[0]?.count || 0)

    // Also search newsItems if includeItems is true and we have a search query
    let items: any[] = []
    let itemCount = 0

    if (includeItems && query && query.length >= 2) {
      const searchPattern = `%${query}%`

      const itemResults = await drizzleDb
        .select({
          id: newsItems.id,
          sourceUrl: newsItems.sourceUrl,
          title: newsItems.originalTitle,
          summaryHr: newsItems.summaryHr,
          publishedAt: newsItems.publishedAt,
          impactLevel: newsItems.impactLevel,
          sourceName: newsSources.name,
        })
        .from(newsItems)
        .leftJoin(newsSources, eq(newsItems.sourceId, newsSources.id))
        .where(
          and(
            isNotNull(newsItems.publishedAt),
            lte(newsItems.publishedAt, new Date()),
            or(
              ilike(newsItems.originalTitle, searchPattern),
              ilike(newsItems.summaryHr, searchPattern)
            )
          )
        )
        .orderBy(desc(newsItems.publishedAt))
        .limit(limit)

      items = itemResults

      const itemCountResult = await drizzleDb
        .select({ count: sql<number>`count(*)` })
        .from(newsItems)
        .where(
          and(
            isNotNull(newsItems.publishedAt),
            lte(newsItems.publishedAt, new Date()),
            or(
              ilike(newsItems.originalTitle, searchPattern),
              ilike(newsItems.summaryHr, searchPattern)
            )
          )
        )

      itemCount = Number(itemCountResult[0]?.count || 0)
    }

    return NextResponse.json({
      posts,
      items: includeItems ? items : undefined,
      count: postCount,
      itemCount: includeItems ? itemCount : undefined,
      totalCount: postCount + itemCount,
      limit,
      offset,
      query: query || null,
    })
  } catch (error) {
    console.error("Error fetching posts:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
