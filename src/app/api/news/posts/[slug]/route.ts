import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts, newsCategories } from "@/lib/db/schema/news"
import { eq, and, lte } from "drizzle-orm"
import { parseParams, isValidationError, formatValidationError } from "@/lib/api/validation"

export const dynamic = "force-dynamic"

const paramsSchema = z.object({
  slug: z.string().min(1, "Slug is required"),
})

/**
 * GET /api/news/posts/[slug]
 *
 * Returns a single published post by slug
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const resolvedParams = await params
    const { slug } = parseParams(resolvedParams, paramsSchema)

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
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Error fetching post:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
