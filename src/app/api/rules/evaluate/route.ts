// src/app/api/rules/evaluate/route.ts

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import {
  parseAppliesWhen,
  evaluateAppliesWhen,
  type EvaluationContext,
} from "@/lib/regulatory-truth/dsl/applies-when"
import { checkRateLimit, getClientIP } from "@/lib/regulatory-truth/utils/rate-limit"
import { apiError } from "@/lib/api-error"
import { auth } from "@/lib/auth"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"

const evaluateBodySchema = z.object({
  context: z
    .object({
      entityType: z.string().optional(),
      jurisdiction: z.string().optional(),
      activityType: z.string().optional(),
      revenue: z.number().optional(),
      employeeCount: z.number().optional(),
      isVatPayer: z.boolean().optional(),
      asOf: z.string().optional(),
    })
    .passthrough(),
})

/**
 * POST /api/rules/evaluate
 *
 * Evaluate which published rules apply to a given context
 * Body: { context: EvaluationContext }
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check rate limit
    const ip = getClientIP(request)
    const rateLimit = checkRateLimit(`evaluate:${ip}`, 60)

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

    const body = await parseBody(request, evaluateBodySchema)
    const context = body.context as unknown as EvaluationContext

    // Ensure asOf is set
    if (!context.asOf) {
      context.asOf = new Date().toISOString()
    }

    // Get all published rules (with reasonable limit to prevent issues)
    const MAX_RULES_TO_EVALUATE = 1000
    const allRules = await db.regulatoryRule.findMany({
      where: { status: "PUBLISHED" },
      take: MAX_RULES_TO_EVALUATE,
      orderBy: [
        { authorityLevel: "asc" }, // LAW first
        { effectiveFrom: "desc" }, // Newest first
      ],
      select: {
        id: true,
        conceptSlug: true,
        titleHr: true,
        titleEn: true,
        riskTier: true,
        authorityLevel: true,
        automationPolicy: true,
        appliesWhen: true,
        value: true,
        valueType: true,
        outcome: true,
        effectiveFrom: true,
        effectiveUntil: true,
        confidence: true,
      },
    })

    if (allRules.length >= MAX_RULES_TO_EVALUATE) {
      console.warn(
        `[evaluate] Hit max rules limit (${MAX_RULES_TO_EVALUATE}), some rules may not be evaluated`
      )
    }

    // Filter to currently effective rules
    const asOfDate = new Date(context.asOf)
    const effectiveRules = allRules.filter((rule) => {
      const from = new Date(rule.effectiveFrom)
      const until = rule.effectiveUntil ? new Date(rule.effectiveUntil) : null
      return from <= asOfDate && (!until || until >= asOfDate)
    })

    // Evaluate appliesWhen for each rule
    const applicableRules = []
    const evaluationResults = []

    for (const rule of effectiveRules) {
      try {
        const predicate = parseAppliesWhen(rule.appliesWhen)
        const applies = evaluateAppliesWhen(predicate, context)

        evaluationResults.push({
          ruleId: rule.id,
          conceptSlug: rule.conceptSlug,
          applies,
        })

        if (applies) {
          applicableRules.push(rule)
        }
      } catch (error) {
        // Skip rules with invalid appliesWhen
        console.warn(`[evaluate] Invalid appliesWhen for rule ${rule.id}:`, error)
      }
    }

    // Sort by authority level (LAW first)
    const authorityOrder = { LAW: 1, GUIDANCE: 2, PROCEDURE: 3, PRACTICE: 4 }
    applicableRules.sort(
      (a, b) => (authorityOrder[a.authorityLevel] || 99) - (authorityOrder[b.authorityLevel] || 99)
    )

    return NextResponse.json({
      context,
      evaluatedAt: new Date().toISOString(),
      totalRulesEvaluated: effectiveRules.length,
      applicableCount: applicableRules.length,
      applicableRules,
      evaluationDetails: evaluationResults,
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("[api/rules/evaluate] Error:", error)
    return NextResponse.json({ error: "Failed to evaluate rules" }, { status: 500 })
  }
}
