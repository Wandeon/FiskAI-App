// src/app/api/deadlines/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getDeadlines, getUpcomingDeadlines, getDeadlinesCount } from "@/lib/deadlines/queries"

export const dynamic = "force-dynamic"

/**
 * GET /api/deadlines
 *
 * Query parameters:
 * - startDate: ISO date string (YYYY-MM-DD)
 * - endDate: ISO date string (YYYY-MM-DD)
 * - deadlineType: 'tax', 'reporting', 'registration', 'regulatory'
 * - businessType: business type filter (e.g., 'pausalni', 'obrt-dohodak', 'jdoo', 'doo')
 * - limit: number of results (default: 50, max: 100)
 * - offset: pagination offset (default: 0)
 * - sortBy: 'date', 'severity', 'created' (default: 'date')
 * - sortOrder: 'asc', 'desc' (default: 'asc')
 * - upcoming: number of days ahead for upcoming deadlines (e.g., 30)
 * - includeCount: 'true' to include total count in response
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Check if this is an upcoming deadlines request
    const upcomingDays = searchParams.get("upcoming")
    if (upcomingDays) {
      const daysAhead = parseInt(upcomingDays, 10)
      if (isNaN(daysAhead) || daysAhead < 1 || daysAhead > 365) {
        return NextResponse.json(
          { error: "Invalid 'upcoming' parameter. Must be between 1 and 365." },
          { status: 400 }
        )
      }

      const businessType = searchParams.get("businessType") || undefined
      const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 100)

      const deadlines = await getUpcomingDeadlines(daysAhead, businessType, limit)

      return NextResponse.json({
        deadlines,
        count: deadlines.length,
        daysAhead,
      })
    }

    // Regular deadlines query
    const startDate = searchParams.get("startDate") || undefined
    const endDate = searchParams.get("endDate") || undefined
    const deadlineType = searchParams.get("deadlineType") || undefined
    const businessType = searchParams.get("businessType") || undefined
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100)
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0)
    const sortBy = (searchParams.get("sortBy") || "date") as "date" | "severity" | "created"
    const sortOrder = (searchParams.get("sortOrder") || "asc") as "asc" | "desc"
    const includeCount = searchParams.get("includeCount") === "true"

    // Validate sortBy
    if (!["date", "severity", "created"].includes(sortBy)) {
      return NextResponse.json(
        { error: "Invalid 'sortBy' parameter. Must be 'date', 'severity', or 'created'." },
        { status: 400 }
      )
    }

    // Validate sortOrder
    if (!["asc", "desc"].includes(sortOrder)) {
      return NextResponse.json(
        { error: "Invalid 'sortOrder' parameter. Must be 'asc' or 'desc'." },
        { status: 400 }
      )
    }

    // Validate date formats if provided
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return NextResponse.json(
        { error: "Invalid 'startDate' format. Use YYYY-MM-DD." },
        { status: 400 }
      )
    }

    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return NextResponse.json(
        { error: "Invalid 'endDate' format. Use YYYY-MM-DD." },
        { status: 400 }
      )
    }

    const deadlines = await getDeadlines({
      startDate,
      endDate,
      deadlineType,
      businessType,
      limit,
      offset,
      sortBy,
      sortOrder,
    })

    const response: any = {
      deadlines,
      pagination: {
        limit,
        offset,
        returned: deadlines.length,
      },
    }

    // Include total count if requested
    if (includeCount) {
      const totalCount = await getDeadlinesCount({
        startDate,
        endDate,
        deadlineType,
        businessType,
      })
      response.pagination.total = totalCount
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Error fetching deadlines:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
