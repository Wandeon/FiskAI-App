import { NextRequest, NextResponse } from "next/server"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts, newsPostSources, newsItems } from "@/lib/db/schema/news"
import { eq } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth-utils"
import { z } from "zod"
import {
  parseParams,
  parseBody,
  isValidationError,
  formatValidationError,
} from "@/lib/api/validation"

const postIdParamsSchema = z.object({
  id: z.string(),
})

const updatePostBodySchema = z.object({
  title: z.string().optional(),
  slug: z.string().optional(),
  content: z.string().optional(),
  excerpt: z.string().optional(),
  categoryId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  featuredImageUrl: z.string().optional(),
  featuredImageSource: z.string().optional(),
  status: z.string().optional(),
  publishedAt: z.string().nullable().optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Check admin auth
  const user = await getCurrentUser()
  if (!user || user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = parseParams(await params, postIdParamsSchema)
    // Fetch post
    const posts = await drizzleDb.select().from(newsPosts).where(eq(newsPosts.id, id)).limit(1)

    if (posts.length === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    // Fetch source items
    const sources = await drizzleDb
      .select({
        newsItem: newsItems,
      })
      .from(newsPostSources)
      .innerJoin(newsItems, eq(newsPostSources.newsItemId, newsItems.id))
      .where(eq(newsPostSources.postId, id))

    return NextResponse.json({
      post: posts[0],
      sourceItems: sources.map((s) => s.newsItem),
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Error fetching post:", error)
    return NextResponse.json({ error: "Failed to fetch post" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Check admin auth
  const user = await getCurrentUser()
  if (!user || user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = parseParams(await params, postIdParamsSchema)
    const body = await parseBody(request, updatePostBodySchema)

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date(),
    }

    // Only update fields that are provided
    if (body.title !== undefined) updateData.title = body.title
    if (body.slug !== undefined) updateData.slug = body.slug
    if (body.content !== undefined) updateData.content = body.content
    if (body.excerpt !== undefined) updateData.excerpt = body.excerpt
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId
    if (body.tags !== undefined) updateData.tags = body.tags
    if (body.featuredImageUrl !== undefined) updateData.featuredImageUrl = body.featuredImageUrl
    if (body.featuredImageSource !== undefined)
      updateData.featuredImageSource = body.featuredImageSource
    if (body.status !== undefined) updateData.status = body.status
    if (body.publishedAt !== undefined) {
      updateData.publishedAt = body.publishedAt ? new Date(body.publishedAt) : null
    }

    // Update post
    const updated = await drizzleDb
      .update(newsPosts)
      .set(updateData)
      .where(eq(newsPosts.id, id))
      .returning()

    if (updated.length === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    return NextResponse.json({ post: updated[0] })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Error updating post:", error)
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check admin auth
  const user = await getCurrentUser()
  if (!user || user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = parseParams(await params, postIdParamsSchema)
    // Delete post (cascade will delete post_sources)
    const deleted = await drizzleDb.delete(newsPosts).where(eq(newsPosts.id, id)).returning()

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Error deleting post:", error)
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 })
  }
}
