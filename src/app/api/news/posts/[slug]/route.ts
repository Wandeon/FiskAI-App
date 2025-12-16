import { NextRequest, NextResponse } from "next/server"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts, newsCategories } from "@/lib/db/schema/news"
import { eq, and, lte } from "drizzle-orm"

export const dynamic = "force-dynamic"

/**
 * GET /api/news/posts/[slug]
 *
 * Returns a single published post by slug
 */
export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { slug } = params

    if (!slug) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 })
    }

    // Fetch post with category info - only if published
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
        createdAt: newsPosts.createdAt,
        updatedAt: newsPosts.updatedAt,
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

    if (result.length === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    return NextResponse.json({ post: result[0] })
  } catch (error) {
    console.error("Error fetching post:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
