// src/app/api/rules/search/route.ts

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { checkRateLimit, getClientIP } from "@/lib/regulatory-truth/utils/rate-limit"
import { parseQuery, isValidationError, formatValidationError } from "@/lib/api/validation"

// Valid enum values for validation
const VALID_RISK_TIERS = ["T0", "T1", "T2", "T3"] as const
const VALID_AUTHORITY_LEVELS = ["LAW", "GUIDANCE", "PROCEDURE", "PRACTICE"] as const

const searchQuerySchema = z.object({
  q: z.string().optional().default(""),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  riskTier: z.enum(VALID_RISK_TIERS).optional(),
  authorityLevel: z.enum(VALID_AUTHORITY_LEVELS).optional(),
  asOfDate: z.string().optional(),
  includeExpired: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
})

/**
 * GET /api/rules/search
 *
 * Search published regulatory rules by keyword
 * Query params:
 * - q: search query (searches conceptSlug, titleHr, titleEn)
 * - limit: max results (default 20, max 100)
 * - riskTier: filter by risk tier (T0, T1, T2, T3)
 * - authorityLevel: filter by authority (LAW, GUIDANCE, PROCEDURE, PRACTICE)
 * - asOfDate: ISO date for temporal filtering (default: now)
 * - includeExpired: set to "true" to include expired rules (for admin/debug)
 *
 * TEMPORAL INVARIANT: By default, only returns rules where:
 *   effectiveFrom <= asOfDate AND (effectiveUntil IS NULL OR effectiveUntil >= asOfDate)
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
    const asOfDateParam = searchParams.get("asOfDate")
    const includeExpired = searchParams.get("includeExpired") === "true"

    // Parse asOfDate or use current time
    let asOfDate: Date
    if (asOfDateParam) {
      asOfDate = new Date(asOfDateParam)
      if (isNaN(asOfDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid asOfDate. Must be a valid ISO date string." },
          { status: 400 }
        )
      }
    } else {
      asOfDate = new Date()
    }

    // Validate enum values
    if (riskTier && !VALID_RISK_TIERS.includes(riskTier as (typeof VALID_RISK_TIERS)[number])) {
      return NextResponse.json(
        { error: `Invalid riskTier. Must be one of: ${VALID_RISK_TIERS.join(", ")}` },
        { status: 400 }
      )
    }

    if (
      authorityLevel &&
      !VALID_AUTHORITY_LEVELS.includes(authorityLevel as (typeof VALID_AUTHORITY_LEVELS)[number])
    ) {
      return NextResponse.json(
        { error: `Invalid authorityLevel. Must be one of: ${VALID_AUTHORITY_LEVELS.join(", ")}` },
        { status: 400 }
      )
    }

    // Build where clause with temporal filtering
    const where: Record<string, unknown> = {
      status: "PUBLISHED",
    }

    // TEMPORAL INVARIANT: Only return temporally valid rules unless explicitly requesting expired
    if (!includeExpired) {
      // Rule must have started: effectiveFrom <= asOfDate
      where.effectiveFrom = { lte: asOfDate }

      // Rule must not have expired: effectiveUntil IS NULL OR effectiveUntil >= asOfDate
      where.OR = [{ effectiveUntil: null }, { effectiveUntil: { gte: asOfDate } }]
    }

    // Add text search if query provided
    if (q) {
      // Combine with existing OR (temporal) using AND
      const textSearch = [
        { conceptSlug: { contains: q, mode: "insensitive" as const } },
        { titleHr: { contains: q, mode: "insensitive" as const } },
        { titleEn: { contains: q, mode: "insensitive" as const } },
      ]

      if (where.OR) {
        // We have temporal OR, need to wrap in AND
        where.AND = [{ OR: where.OR }, { OR: textSearch }]
        delete where.OR
      } else {
        where.OR = textSearch
      }
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
      asOfDate: asOfDate.toISOString(),
      rules,
    })
  } catch (error) {
    console.error("[api/rules/search] Error:", error)
    return NextResponse.json({ error: "Failed to search rules" }, { status: 500 })
  }
}
