import { NextRequest, NextResponse } from "next/server"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts } from "@/lib/db/schema/news"
import { eq, desc, and, gte, lte, like } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth-utils"
import { z } from "zod"
import { parseQuery, isValidationError, formatValidationError } from "@/lib/api/validation"

const newsPostsQuerySchema = z.object({
  status: z.string().optional(),
  category: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  search: z.string().optional(),
})

export async function GET(request: NextRequest) {
  // Check admin auth
  const user = await getCurrentUser()
  if (!user || user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const {
      status,
      category: categoryId,
      fromDate,
      toDate,
      search,
    } = parseQuery(request.nextUrl.searchParams, newsPostsQuerySchema)
    // Build query conditions
    const conditions = []

    if (status) {
      conditions.push(eq(newsPosts.status, status))
    }

    if (categoryId) {
      conditions.push(eq(newsPosts.categoryId, categoryId))
    }

    if (fromDate) {
      conditions.push(gte(newsPosts.publishedAt, new Date(fromDate)))
    }

    if (toDate) {
      conditions.push(lte(newsPosts.publishedAt, new Date(toDate)))
    }

    if (search) {
      conditions.push(like(newsPosts.title, `%${search}%`))
    }

    // Fetch posts
    let query = drizzleDb.select().from(newsPosts)

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any
    }

    const posts = await query.orderBy(desc(newsPosts.createdAt)).limit(100)

    return NextResponse.json({ posts })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Error fetching posts:", error)
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 })
  }
}
