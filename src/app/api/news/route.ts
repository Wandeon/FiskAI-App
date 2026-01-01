// src/app/api/news/route.ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsItems } from "@/lib/db/schema/news"
import { eq, desc, and, sql } from "drizzle-orm"
import { parseQuery, isValidationError, formatValidationError } from "@/lib/api/validation"

export const dynamic = "force-dynamic"

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(50).default(10),
  category: z.string().optional(),
  status: z.string().default("processed"),
})

/**
 * GET /api/news
 *
 * Query parameters:
 * - limit: number of results (default: 10, max: 50)
 * - category: filter by category (e.g., 'tax', 'vat', 'regulatory')
 * - status: filter by status (default: 'processed')
 */
export async function GET(request: NextRequest) {
  try {
    const { limit, category, status } = parseQuery(request.nextUrl.searchParams, querySchema)

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
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Error fetching news:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
