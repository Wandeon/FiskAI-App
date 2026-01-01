// src/app/api/admin/regulatory-truth/trigger/route.ts

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth-utils"
import { runSentinel } from "@/lib/regulatory-truth/agents/sentinel"
import { runExtractorBatch } from "@/lib/regulatory-truth/agents/extractor"
import { runComposerBatch } from "@/lib/regulatory-truth/agents/composer"
import { runReviewer } from "@/lib/regulatory-truth/agents/reviewer"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"

const postBodySchema = z.object({
  phase: z.enum(["discovery", "extraction", "composition", "review", "all"]).default("all"),
})

type PipelinePhase = z.infer<typeof postBodySchema>["phase"]

/**
 * POST /api/admin/regulatory-truth/trigger
 *
 * Trigger regulatory pipeline phases
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { phase } = await parseBody(request, postBodySchema)

    const results: Record<string, unknown> = {
      triggeredBy: user.id,
      triggeredAt: new Date().toISOString(),
      phase,
    }

    // Execute requested phase(s)
    if (phase === "discovery" || phase === "all") {
      console.log("[trigger] Running discovery phase...")
      const discoveryResult = await runSentinel()
      results.discovery = discoveryResult
    }

    if (phase === "extraction" || phase === "all") {
      console.log("[trigger] Running extraction phase...")
      const extractionResult = await runExtractorBatch()
      results.extraction = extractionResult
    }

    if (phase === "composition" || phase === "all") {
      console.log("[trigger] Running composition phase...")
      const compositionResult = await runComposerBatch()
      results.composition = compositionResult
    }

    if (phase === "review" || phase === "all") {
      console.log("[trigger] Running review phase...")

      // Get pending rules that need review
      const pendingRules = await db.regulatoryRule.findMany({
        where: {
          status: "DRAFT",
          reviewerNotes: null,
        },
        select: { id: true },
        take: 20,
      })

      const reviewResults = {
        processed: 0,
        approved: 0,
        rejected: 0,
        escalated: 0,
        errors: [] as string[],
      }

      for (const rule of pendingRules) {
        try {
          const reviewResult = await runReviewer(rule.id)
          if (reviewResult.success) {
            reviewResults.processed++
            // Check final status
            const updatedRule = await db.regulatoryRule.findUnique({
              where: { id: rule.id },
              select: { status: true },
            })
            if (updatedRule?.status === "APPROVED") reviewResults.approved++
            else if (updatedRule?.status === "REJECTED") reviewResults.rejected++
            else if (updatedRule?.status === "PENDING_REVIEW") reviewResults.escalated++
          } else {
            reviewResults.errors.push(reviewResult.error || "Unknown error")
          }
        } catch (error) {
          reviewResults.errors.push(error instanceof Error ? error.message : String(error))
        }
      }

      results.review = reviewResults
    }

    return NextResponse.json({
      success: true,
      message: `Pipeline phase '${phase}' completed`,
      results,
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("[trigger] Error:", error)
    return NextResponse.json(
      { error: "Failed to trigger pipeline", details: String(error) },
      { status: 500 }
    )
  }
}
