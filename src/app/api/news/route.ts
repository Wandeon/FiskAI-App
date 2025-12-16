// src/app/api/news/route.ts
import { NextRequest, NextResponse } from "next/server"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsItems } from "@/lib/db/schema/news"
import { eq, desc, and, sql } from "drizzle-orm"

export const dynamic = "force-dynamic"

/**
 * GET /api/news
 *
 * Query parameters:
 * - limit: number of results (default: 10, max: 50)
 * - category: filter by category (e.g., 'tax', 'vat', 'regulatory')
 * - status: filter by status (default: 'processed', options: 'pending', 'processed', 'published', 'archived')
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Parse and validate parameters
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50)
    const category = searchParams.get("category") || undefined
    const status = searchParams.get("status") || "processed"

    // Validate status
    if (!["pending", "processed", "published", "archived"].includes(status)) {
      return NextResponse.json(
        {
          error:
            "Invalid 'status' parameter. Must be 'pending', 'processed', 'published', or 'archived'.",
        },
        { status: 400 }
      )
    }

    // Build query conditions
    const conditions = [eq(newsItems.status, status)]

    // Add category filter if provided
    if (category) {
      conditions.push(sql`${newsItems.categories} @> ${JSON.stringify([category])}`)
    }

    // Execute query
    const news = await drizzleDb
      .select()
      .from(newsItems)
      .where(and(...conditions))
      .orderBy(desc(newsItems.publishedAt))
      .limit(limit)

    // Get total count with same filters
    const countResult = await drizzleDb
      .select({ count: sql<number>`count(*)` })
      .from(newsItems)
      .where(and(...conditions))

    const count = Number(countResult[0]?.count || 0)

    return NextResponse.json({
      news,
      count,
    })
  } catch (error) {
    console.error("Error fetching news:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
