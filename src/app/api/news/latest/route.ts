// src/app/api/news/latest/route.ts
import { NextRequest, NextResponse } from "next/server"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsItems } from "@/lib/db/schema/news"
import { eq, desc, sql } from "drizzle-orm"
import { isValidationError, formatValidationError } from "@/lib/api/validation"

export const dynamic = "force-dynamic"

/**
 * GET /api/news/latest
 *
 * Returns the 3 most recent processed news items
 * Response includes the timestamp of when the data was updated
 */
export async function GET(request: NextRequest) {
  try {
    // Fetch 3 most recent processed items
    const news = await drizzleDb
      .select()
      .from(newsItems)
      .where(eq(newsItems.status, "processed"))
      .orderBy(desc(newsItems.publishedAt))
      .limit(3)

    // Get the most recent updatedAt timestamp
    const updatedAtResult = await drizzleDb
      .select({ updatedAt: sql<Date>`MAX(${newsItems.updatedAt})` })
      .from(newsItems)
      .where(eq(newsItems.status, "processed"))

    const updatedAt = updatedAtResult[0]?.updatedAt || new Date()

    return NextResponse.json({
      news,
      updatedAt,
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Error fetching latest news:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
