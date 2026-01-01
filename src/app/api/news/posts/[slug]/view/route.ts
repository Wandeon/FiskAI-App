// src/app/api/news/posts/[slug]/view/route.ts
import { NextResponse } from "next/server"
import { z } from "zod"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts } from "@/lib/db/schema/news"
import { eq, sql } from "drizzle-orm"
import { parseParams, isValidationError, formatValidationError } from "@/lib/api/validation"

const paramsSchema = z.object({
  slug: z.string().min(1, "Slug is required"),
})

/**
 * POST /api/news/posts/[slug]/view
 * Increment view count for a news post (privacy-friendly - no user tracking)
 */
export async function POST(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const resolvedParams = await params
    const { slug } = parseParams(resolvedParams, paramsSchema)

    // Increment view count atomically
    await drizzleDb
      .update(newsPosts)
      .set({
        viewCount: sql`${newsPosts.viewCount} + 1`,
      })
      .where(eq(newsPosts.slug, slug))

    return NextResponse.json({ success: true })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Failed to increment view count:", error)
    return NextResponse.json({ error: "Failed to track view" }, { status: 500 })
  }
}
