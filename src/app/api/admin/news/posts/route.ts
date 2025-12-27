import { NextRequest, NextResponse } from "next/server"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts } from "@/lib/db/schema/news"
import { eq, desc, and, gte, lte, like } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth-utils"

export async function GET(request: NextRequest) {
  // Check admin auth
  const user = await getCurrentUser()
  if (!user || user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const status = searchParams.get("status")
  const categoryId = searchParams.get("category")
  const fromDate = searchParams.get("fromDate")
  const toDate = searchParams.get("toDate")
  const search = searchParams.get("search")

  try {
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
    console.error("Error fetching posts:", error)
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 })
  }
}
