// src/lib/regulatory-truth/agents/claim-extractor.ts

import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { runAgent } from "./runner"
import { AtomicClaimSchema, type AtomicClaim } from "../schemas/atomic-claim"
import { getExtractableContent } from "../utils/content-provider"
import { cleanContent } from "../utils/content-cleaner"
import {
  validateAtomicClaim,
  checkClaimDuplicate,
  type AtomicClaimInput,
} from "../utils/deterministic-validators"
import { z } from "zod"

const ClaimExtractorInputSchema = z.object({
  evidenceId: z.string(),
  content: z.string(),
  url: z.string(),
})

const ClaimExtractorOutputSchema = z.object({
  claims: z.array(AtomicClaimSchema),
  extractionNotes: z.string().optional(),
})

type ClaimExtractorInput = z.infer<typeof ClaimExtractorInputSchema>
type ClaimExtractorOutput = z.infer<typeof ClaimExtractorOutputSchema>

export interface ClaimExtractionResult {
  success: boolean
  claims: AtomicClaim[]
  claimIds: string[]
  error: string | null
  stats?: {
    extracted: number
    validated: number
    rejected: number
    duplicatesSkipped: number
  }
}

/**
 * Extract atomic claims from regulatory content
 */
export async function runClaimExtractor(evidenceId: string): Promise<ClaimExtractionResult> {
  const evidence = await db.evidence.findUnique({
    where: { id: evidenceId },
  })

  if (!evidence) {
    return {
      success: false,
      claims: [],
      claimIds: [],
      error: `Evidence not found: ${evidenceId}`,
    }
  }

  // Get extractable content
  const { text: content } = await getExtractableContent(evidenceId)
  const cleanedContent = cleanContent(content, evidence.url)

  const input: ClaimExtractorInput = {
    evidenceId: evidence.id,
    content: cleanedContent.slice(0, 50000), // Limit content size
    url: evidence.url,
  }

  const result = await runAgent<ClaimExtractorInput, ClaimExtractorOutput>({
    agentType: "CLAIM_EXTRACTOR",
    input,
    inputSchema: ClaimExtractorInputSchema,
    outputSchema: ClaimExtractorOutputSchema,
    temperature: 0.1,
    evidenceId: evidence.id,
  })

  if (!result.success || !result.output) {
    return {
      success: false,
      claims: [],
      claimIds: [],
      error: result.error ?? "Claim extraction failed",
    }
  }

  // =============================================================================
  // DETERMINISTIC VALIDATION (Fail-Closed)
  // =============================================================================

  const claimIds: string[] = []
  const validatedClaims: AtomicClaim[] = []
  const rejectedClaims: Array<{ claim: AtomicClaim; errors: string[]; rejectionType: string }> = []
  let duplicatesSkipped = 0

  // Track claims we're about to add to prevent intra-batch duplicates
  const pendingSignatures = new Set<string>()

  for (const claim of result.output.claims) {
    // Step 1: Validate the claim structure and values
    const claimInput: AtomicClaimInput = {
      subjectType: claim.subjectType,
      subjectQualifiers: claim.subjectQualifiers,
      triggerExpr: claim.triggerExpr,
      temporalExpr: claim.temporalExpr,
      jurisdiction: claim.jurisdiction,
      assertionType: claim.assertionType,
      logicExpr: claim.logicExpr,
      value: claim.value,
      valueType: claim.valueType,
      parameters: claim.parameters as Record<string, unknown> | null,
      exactQuote: claim.exactQuote,
      articleNumber: claim.articleNumber,
      lawReference: claim.lawReference,
      confidence: claim.confidence,
      exceptions: claim.exceptions,
    }

    const validation = validateAtomicClaim(claimInput, cleanedContent)

    if (!validation.valid) {
      rejectedClaims.push({
        claim,
        errors: validation.errors,
        rejectionType: validation.rejectionType || "VALIDATION_FAILED",
      })

      console.warn(`[claim-extractor] Rejected claim: ${validation.errors.join(", ")}`)

      // Store in dead-letter table for analysis
      await db.extractionRejected.create({
        data: {
          evidenceId: evidence.id,
          rejectionType: validation.rejectionType || "VALIDATION_FAILED",
          rawOutput: claim as unknown as Prisma.InputJsonValue,
          errorDetails: validation.errors.join("; "),
        },
      })

      continue
    }

    // Log warnings but don't reject
    if (validation.warnings.length > 0) {
      console.warn(`[claim-extractor] Warning for claim: ${validation.warnings.join(", ")}`)
    }

    // Step 2: Check for database duplicates
    const duplicateCheck = await checkClaimDuplicate(claimInput, evidence.id, db)
    if (duplicateCheck.isDuplicate) {
      console.log(`[claim-extractor] Skipping duplicate: ${duplicateCheck.reason}`)
      duplicatesSkipped++
      continue
    }

    // Step 3: Check for intra-batch duplicates
    const signature = `${claim.subjectType}|${claim.assertionType}|${claim.logicExpr}|${claim.value || ""}|${claim.exactQuote}`
    if (pendingSignatures.has(signature)) {
      console.log(`[claim-extractor] Skipping intra-batch duplicate`)
      duplicatesSkipped++
      continue
    }
    pendingSignatures.add(signature)

    // =============================================================================
    // STORE VALIDATED CLAIM
    // =============================================================================

    const dbClaim = await db.atomicClaim.create({
      data: {
        subjectType: claim.subjectType,
        subjectQualifiers: claim.subjectQualifiers,
        triggerExpr: claim.triggerExpr,
        temporalExpr: claim.temporalExpr,
        jurisdiction: claim.jurisdiction,
        assertionType: claim.assertionType,
        logicExpr: claim.logicExpr,
        value: claim.value,
        valueType: claim.valueType,
        parameters: claim.parameters as Record<string, unknown> | undefined,
        exactQuote: claim.exactQuote,
        articleNumber: claim.articleNumber,
        lawReference: claim.lawReference,
        confidence: claim.confidence,
        evidenceId: evidence.id,
      },
    })

    claimIds.push(dbClaim.id)
    validatedClaims.push(claim)

    // Create exceptions if any
    if (claim.exceptions && claim.exceptions.length > 0) {
      for (const exception of claim.exceptions) {
        await db.claimException.create({
          data: {
            claimId: dbClaim.id,
            condition: exception.condition,
            overridesTo: exception.overridesTo,
            sourceArticle: exception.sourceArticle,
          },
        })
      }
    }
  }

  // Log extraction stats
  const stats = {
    extracted: result.output.claims.length,
    validated: validatedClaims.length,
    rejected: rejectedClaims.length,
    duplicatesSkipped,
  }

  console.log(
    `[claim-extractor] Extracted ${stats.extracted} claims, validated ${stats.validated}, rejected ${stats.rejected}, skipped ${stats.duplicatesSkipped} duplicates from ${evidence.url}`
  )

  // Log rejection stats by type
  if (rejectedClaims.length > 0) {
    const rejectionTypes = rejectedClaims.reduce(
      (acc, r) => {
        acc[r.rejectionType] = (acc[r.rejectionType] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )
    console.warn(`[claim-extractor] Rejection breakdown: ${JSON.stringify(rejectionTypes)}`)
  }

  return {
    success: true,
    claims: validatedClaims,
    claimIds,
    error: null,
    stats,
  }
}
