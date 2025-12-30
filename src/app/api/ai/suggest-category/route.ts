import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { suggestCategory, suggestCategoryByVendor } from "@/lib/ai/categorize"
import { db } from "@/lib/db"
import { withApiLogging } from "@/lib/api-logging"
import { updateContext } from "@/lib/context"
import { logger } from "@/lib/logger"
import { InMemoryRateLimiter } from "@/lib/ai/rate-limiter"

// Simple rate limiting for category suggestions (no AI calls, just DB queries)
// 60 requests per minute (1 per second average)
const inMemoryLimiter = new InMemoryRateLimiter({
  windowMs: 60_000,
  maxRequests: 60,
})

export const POST = withApiLogging(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  updateContext({ userId: session.user.id })

  try {
    const body = await req.json()
    const { description, vendor } = body

    const companyUser = await db.companyUser.findFirst({
      where: { userId: session.user.id, isDefault: true },
      include: { company: true },
    })

    if (!companyUser?.company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    const companyId = companyUser.company.id
    updateContext({ companyId })

    // Check rate limit
    const rateLimitCheck = inMemoryLimiter.check(companyId)
    if (!rateLimitCheck.allowed) {
      logger.warn({ companyId }, "Category suggestion rate limit exceeded")
      return NextResponse.json(
        { error: "Too many requests", retryAfter: rateLimitCheck.retryAfter },
        { status: 429 }
      )
    }

    const suggestions = []

    if (vendor) {
      const vendorSuggestion = await suggestCategoryByVendor(vendor, companyId)
      if (vendorSuggestion) {
        suggestions.push(vendorSuggestion)
      }
    }

    if (description) {
      const descSuggestions = await suggestCategory(description, companyId)
      suggestions.push(...descSuggestions)
    }

    const uniqueSuggestions = suggestions
      .filter(
        (suggestion, index, self) =>
          index === self.findIndex((s) => s.categoryId === suggestion.categoryId)
      )
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)

    return NextResponse.json({ suggestions: uniqueSuggestions })
  } catch (error) {
    logger.error({ error }, "Category suggestion error")
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Suggestion failed" },
      { status: 500 }
    )
  }
})
