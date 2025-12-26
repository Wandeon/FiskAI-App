// src/lib/regulatory-truth/agents/claim-extractor.ts

import { db } from "@/lib/db"
import { runAgent } from "./runner"
import { AtomicClaimSchema, type AtomicClaim } from "../schemas/atomic-claim"
import { getExtractableContent } from "../utils/content-provider"
import { cleanContent } from "../utils/content-cleaner"
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

  // Store claims in database
  const claimIds: string[] = []

  for (const claim of result.output.claims) {
    // Create the atomic claim
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

  console.log(`[claim-extractor] Extracted ${claimIds.length} claims from ${evidence.url}`)

  return {
    success: true,
    claims: result.output.claims,
    claimIds,
    error: null,
  }
}
