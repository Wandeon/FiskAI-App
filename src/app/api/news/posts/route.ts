import { NextRequest, NextResponse } from "next/server"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts, newsCategories } from "@/lib/db/schema/news"
import { eq, desc, and, sql, lte } from "drizzle-orm"

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
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Parse and validate parameters
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50)
    const offset = parseInt(searchParams.get("offset") || "0", 10)
    const categorySlug = searchParams.get("category") || undefined
    const type = searchParams.get("type") || undefined

    // Build query conditions - only published posts
    const conditions = [eq(newsPosts.status, "published"), lte(newsPosts.publishedAt, new Date())]

    // Add type filter if provided
    if (type === "individual" || type === "digest") {
      conditions.push(eq(newsPosts.type, type))
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

    const count = Number(countResult[0]?.count || 0)

    return NextResponse.json({
      posts,
      count,
      limit,
      offset,
    })
  } catch (error) {
    console.error("Error fetching posts:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
