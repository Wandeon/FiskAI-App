// src/app/api/rules/search/route.ts

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { checkRateLimit, getClientIP } from "@/lib/regulatory-truth/utils/rate-limit"

/**
 * GET /api/rules/search
 *
 * Search published regulatory rules by keyword
 * Query params:
 * - q: search query (searches conceptSlug, titleHr, titleEn)
 * - limit: max results (default 20, max 100)
 * - riskTier: filter by risk tier (T0, T1, T2, T3)
 * - authorityLevel: filter by authority (LAW, GUIDANCE, PROCEDURE, PRACTICE)
 */
export async function GET(request: NextRequest) {
  try {
    // Check rate limit
    const ip = getClientIP(request)
    const rateLimit = checkRateLimit(`search:${ip}`, 60)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(rateLimit.resetAt),
          },
        }
      )
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q") || ""
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100)
    const riskTier = searchParams.get("riskTier")
    const authorityLevel = searchParams.get("authorityLevel")

    const where: Record<string, unknown> = {
      status: "PUBLISHED",
    }

    if (q) {
      where.OR = [
        { conceptSlug: { contains: q, mode: "insensitive" } },
        { titleHr: { contains: q, mode: "insensitive" } },
        { titleEn: { contains: q, mode: "insensitive" } },
      ]
    }

    if (riskTier) {
      where.riskTier = riskTier
    }

    if (authorityLevel) {
      where.authorityLevel = authorityLevel
    }

    const rules = await db.regulatoryRule.findMany({
      where,
      take: limit,
      orderBy: [{ authorityLevel: "asc" }, { effectiveFrom: "desc" }],
      select: {
        id: true,
        conceptSlug: true,
        titleHr: true,
        titleEn: true,
        riskTier: true,
        authorityLevel: true,
        appliesWhen: true,
        value: true,
        valueType: true,
        effectiveFrom: true,
        effectiveUntil: true,
        confidence: true,
        sourcePointers: {
          select: {
            id: true,
            exactQuote: true,
            evidence: {
              select: {
                url: true,
                source: {
                  select: { name: true, slug: true },
                },
              },
            },
          },
        },
      },
    })

    return NextResponse.json({
      query: q,
      count: rules.length,
      rules,
    })
  } catch (error) {
    console.error("[api/rules/search] Error:", error)
    return NextResponse.json({ error: "Failed to search rules" }, { status: 500 })
  }
}
