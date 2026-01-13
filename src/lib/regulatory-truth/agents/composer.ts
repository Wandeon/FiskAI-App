// src/lib/regulatory-truth/agents/composer.ts

import { db, dbReg } from "@/lib/db"
import {
  ComposerInputSchema,
  ComposerOutputSchema,
  type ComposerInput,
  type ComposerOutput,
} from "../schemas"
import { runAgent } from "./runner"
import { logAuditEvent } from "../utils/audit-log"
import { deriveAuthorityLevel } from "../utils/authority"
import { validateAppliesWhen } from "../dsl/applies-when"
import { detectStructuralConflicts, seedConflicts } from "../utils/conflict-detector"
import { withSoftFail } from "../utils/soft-fail"
import {
  isBlockedDomain,
  resolveCanonicalConcept,
  mergePointersToExistingRule,
} from "../utils/concept-resolver"
import { computeMeaningSignature } from "../utils/meaning-signature"
import { validateExplanation, createQuoteOnlyExplanation } from "../utils/explanation-validator"
import { createEdgeWithCycleCheck, CycleDetectedError } from "../graph/cycle-detection"
import { validateSourceConsistency, logCrossSourceReferences } from "../utils/source-consistency"
import { computeDerivedConfidence } from "../utils/derived-confidence"

// =============================================================================
// COMPOSER AGENT
// =============================================================================

export interface ComposerResult {
  success: boolean
  output: ComposerOutput | null
  ruleId: string | null
  agentRunId: string | null // PHASE-D: For outcome updates via updateRunOutcome
  error: string | null
}

/** Correlation options for tracking agent runs across the pipeline */
export interface CorrelationOptions {
  runId?: string
  jobId?: string
  parentJobId?: string
  sourceSlug?: string
  queueName?: string
}

/**
 * Run the Composer agent to create Draft Rules from SourcePointers
 */
export async function runComposer(
  sourcePointerIds: string[],
  correlationOpts?: CorrelationOptions
): Promise<ComposerResult> {
  if (sourcePointerIds.length === 0) {
    return {
      success: false,
      output: null,
      ruleId: null,
      agentRunId: null,
      error: "No source pointer IDs provided",
    }
  }

  // Get source pointers from database (without evidence relation)
  const sourcePointers = await db.sourcePointer.findMany({
    where: { id: { in: sourcePointerIds } },
  })

  // Fetch evidence records separately via dbReg (soft reference via evidenceId)
  const evidenceIds = sourcePointers.map((sp) => sp.evidenceId)
  const evidenceRecords = await dbReg.evidence.findMany({
    where: { id: { in: evidenceIds } },
    include: { source: true },
  })
  const evidenceMap = new Map(evidenceRecords.map((e) => [e.id, e]))

  if (sourcePointers.length === 0) {
    return {
      success: false,
      output: null,
      ruleId: null,
      agentRunId: null,
      error: `No source pointers found for IDs: ${sourcePointerIds.join(", ")}`,
    }
  }

  // GUARD: Block test/synthetic domains from creating rules
  const domains = [...new Set(sourcePointers.map((sp) => sp.domain))]
  const blockedDomains = domains.filter(isBlockedDomain)
  if (blockedDomains.length > 0) {
    console.log(`[composer] Blocked test domains: ${blockedDomains.join(", ")}`)
    return {
      success: false,
      output: null,
      ruleId: null,
      agentRunId: null,
      error: `Blocked domain(s): ${blockedDomains.join(", ")}. Test data cannot create rules.`,
    }
  }

  // ISSUE #906: Validate source attribution integrity
  // Verify that pointer.evidenceId sources are consistent across all pointers
  // Need to build the EvidenceWithSource map for the function
  const sourceConsistencyEvidenceMap = new Map(
    evidenceRecords.map((e) => [
      e.id,
      {
        id: e.id,
        sourceId: e.sourceId,
        source: e.source ? { id: e.source.id, slug: e.source.slug, name: e.source.name } : null,
      },
    ])
  )
  const sourceConsistency = await validateSourceConsistency(
    sourcePointers,
    sourceConsistencyEvidenceMap
  )
  if (sourceConsistency.crossSourceReferences.length > 0) {
    console.warn(
      `[composer] Cross-source references detected: ${sourceConsistency.warnings.join("; ")}`
    )
    // Log audit event for compliance tracking
    await logCrossSourceReferences(sourcePointerIds[0], sourceConsistency)
  }

  // Build input for agent
  const input: ComposerInput = {
    sourcePointerIds: sourcePointers.map((sp) => sp.id),
    sourcePointers: sourcePointers.map((sp) => ({
      id: sp.id,
      domain: sp.domain,
      extractedValue: sp.extractedValue,
      exactQuote: sp.exactQuote,
      confidence: sp.confidence,
    })),
  }

  // Run the agent
  const result = await runAgent<ComposerInput, ComposerOutput>({
    agentType: "COMPOSER",
    input,
    inputSchema: ComposerInputSchema,
    outputSchema: ComposerOutputSchema,
    temperature: 0.1,
    // Pass correlation options from worker
    runId: correlationOpts?.runId,
    jobId: correlationOpts?.jobId,
    parentJobId: correlationOpts?.parentJobId,
    sourceSlug: correlationOpts?.sourceSlug,
    queueName: correlationOpts?.queueName ?? "compose",
  })

  if (!result.success || !result.output) {
    return {
      success: false,
      output: null,
      ruleId: null,
      agentRunId: result.agentRunId ?? null,
      error: result.error,
    }
  }

  // Check if conflicts were detected
  if (result.output.conflicts_detected) {
    // For SOURCE_CONFLICT, we store SourcePointer IDs in metadata only
    // itemAId/itemBId are FKs to RegulatoryRule, not SourcePointer
    // Leave them null for SOURCE_CONFLICT type - Arbiter handles via metadata

    // Create a conflict record for Arbiter to resolve later
    const conflict = await db.regulatoryConflict.create({
      data: {
        conflictType: "SOURCE_CONFLICT",
        status: "OPEN",
        // itemAId/itemBId are null for SOURCE_CONFLICT (they reference RegulatoryRule, not SourcePointer)
        itemAId: null,
        itemBId: null,
        description:
          result.output.conflicts_detected.description ||
          "Conflicting values detected in source pointers",
        metadata: {
          sourcePointerIds: sourcePointerIds,
          conflictingPointerIds: sourcePointerIds.slice(0, 2), // First two for easy reference
          detectedBy: "COMPOSER",
          conflictDetails: result.output.conflicts_detected,
        },
      },
    })

    // Log audit event for conflict creation
    await logAuditEvent({
      action: "CONFLICT_CREATED",
      entityType: "CONFLICT",
      entityId: conflict.id,
      metadata: {
        conflictType: "SOURCE_CONFLICT",
        sourcePointerCount: sourcePointerIds.length,
        conflictingPointerIds: sourcePointerIds.slice(0, 2),
      },
    })

    console.log(`[composer] Created conflict ${conflict.id} for Arbiter resolution`)

    return {
      success: false,
      output: result.output,
      ruleId: null,
      agentRunId: result.agentRunId ?? null,
      error: `Conflict detected (${conflict.id}) - queued for Arbiter`,
    }
  }

  const draftRule = result.output.draft_rule

  // Normalize applies_when to object for validation
  // The schema preprocessor may have stringified it, so we need to parse it back
  let appliesWhenObj: unknown
  if (typeof draftRule.applies_when === "string") {
    try {
      appliesWhenObj = JSON.parse(draftRule.applies_when)
    } catch {
      appliesWhenObj = null
    }
  } else {
    appliesWhenObj = draftRule.applies_when
  }

  // Validate AppliesWhen DSL before storing
  // FAIL-CLOSED: Invalid DSL must REJECT the rule, not silently broaden applicability
  // See PR #89 CRIT fix - replacing with { op: "true" } violates fail-closed principle
  const dslValidation = validateAppliesWhen(appliesWhenObj)
  if (!dslValidation.valid) {
    console.error(
      `[composer] REJECTING rule with invalid AppliesWhen DSL: ${draftRule.concept_slug}`
    )
    console.error(`[composer] DSL validation error: ${dslValidation.error}`)
    console.error(`[composer] Original DSL: ${JSON.stringify(appliesWhenObj)}`)

    // FAIL-CLOSED: Reject the rule instead of silently broadening its applicability
    // Previously this was replaced with { op: "true" } which made the rule apply universally
    return {
      success: false,
      output: result.output,
      ruleId: null,
      agentRunId: result.agentRunId ?? null,
      error: `Cannot create rule "${draftRule.concept_slug}" with invalid AppliesWhen DSL: ${dslValidation.error}. Rules with invalid applicability conditions must be rejected to prevent incorrect application.`,
    }
  }

  // Serialize appliesWhen to JSON string for database storage
  const appliesWhenString =
    typeof appliesWhenObj === "string" ? appliesWhenObj : JSON.stringify(appliesWhenObj)

  // Derive authority level from sources (fetched separately via evidenceMap)
  const sourceSlugs = sourcePointers
    .map((sp) => evidenceMap.get(sp.evidenceId)?.source?.slug)
    .filter((slug): slug is string => slug !== undefined)
  const authorityLevel = deriveAuthorityLevel(sourceSlugs)

  // IMPORTANT: Use the actual input source pointer IDs, not the LLM output
  // The LLM sometimes hallucinates IDs that don't exist in the database
  const validSourcePointerIds = sourcePointerIds

  // CRITICAL VALIDATION: Rules MUST have at least one source pointer
  // Without source pointers, rules cannot be verified or traced back to evidence
  if (validSourcePointerIds.length === 0) {
    console.error(
      `[composer] Cannot create rule without source pointers: ${draftRule.concept_slug}`
    )
    return {
      success: false,
      output: result.output,
      ruleId: null,
      agentRunId: result.agentRunId ?? null,
      error: `Cannot create rule "${draftRule.concept_slug}" without source pointers. Rules must be traceable to evidence.`,
    }
  }

  // Verify all pointer IDs exist in database
  const existingPointers = await db.sourcePointer.findMany({
    where: { id: { in: validSourcePointerIds } },
    select: { id: true },
  })

  if (existingPointers.length !== validSourcePointerIds.length) {
    const missingIds = validSourcePointerIds.filter(
      (id) => !existingPointers.some((p) => p.id === id)
    )
    console.error(
      `[composer] Missing source pointers for ${draftRule.concept_slug}: expected ${validSourcePointerIds.length}, found ${existingPointers.length}`
    )
    console.error(`[composer] Missing IDs: ${missingIds.join(", ")}`)
    return {
      success: false,
      output: result.output,
      ruleId: null,
      agentRunId: result.agentRunId ?? null,
      error: `Cannot create rule "${draftRule.concept_slug}": ${missingIds.length} source pointer(s) not found in database`,
    }
  }

  console.log(
    `[composer] Linking ${validSourcePointerIds.length} source pointers (LLM returned ${draftRule.source_pointer_ids?.length || 0})`
  )

  // DEDUPLICATION: Check if this rule already exists (same value + valueType + time)
  const resolution = await resolveCanonicalConcept(
    draftRule.concept_slug,
    String(draftRule.value),
    draftRule.value_type,
    new Date(draftRule.effective_from)
  )

  if (resolution.shouldMerge && resolution.existingRuleId) {
    // Merge pointers to existing rule instead of creating duplicate
    console.log(
      `[composer] Found existing rule ${resolution.existingRuleId} with same value. Merging pointers.`
    )

    const mergeResult = await mergePointersToExistingRule(
      resolution.existingRuleId,
      validSourcePointerIds
    )

    await logAuditEvent({
      action: "RULE_MERGED",
      entityType: "RULE",
      entityId: resolution.existingRuleId,
      metadata: {
        proposedSlug: draftRule.concept_slug,
        canonicalSlug: resolution.canonicalSlug,
        addedPointers: mergeResult.addedPointers,
        reason: resolution.mergeReason,
      },
    })

    return {
      success: true,
      output: result.output,
      ruleId: resolution.existingRuleId,
      agentRunId: result.agentRunId ?? null,
      error: null,
    }
  }

  // Use canonical slug if different from proposed
  const finalConceptSlug = resolution.canonicalSlug
  if (finalConceptSlug !== draftRule.concept_slug) {
    console.log(
      `[composer] Resolved concept slug: ${draftRule.concept_slug} -> ${finalConceptSlug}`
    )
  }

  // Compute meaning signature for uniqueness enforcement
  const effectiveFromDate = new Date(draftRule.effective_from)
  const effectiveUntilDate = draftRule.effective_until ? new Date(draftRule.effective_until) : null
  const meaningSignature = computeMeaningSignature({
    conceptSlug: finalConceptSlug,
    value: String(draftRule.value),
    valueType: draftRule.value_type,
    effectiveFrom: effectiveFromDate,
    effectiveUntil: effectiveUntilDate,
  })

  // Issue #770: Compute derived confidence from source pointer quality
  // This prevents high LLM-confidence rules backed by low-quality extractions
  const derivedConfidence = computeDerivedConfidence(
    sourcePointers.map((sp) => ({ confidence: sp.confidence })),
    draftRule.llm_confidence
  )

  // PHASE 4: Validate explanation against source evidence
  // This prevents hallucination by ensuring modal verbs and values come from sources
  // Fetch the actual source pointers with exactQuote
  const pointersWithQuotes = await db.sourcePointer.findMany({
    where: { id: { in: validSourcePointerIds } },
    select: { exactQuote: true },
  })
  const sourceQuotes = pointersWithQuotes.map((p) => p.exactQuote).filter(Boolean) as string[]
  const explanationValidation = validateExplanation(
    draftRule.explanation_hr,
    draftRule.explanation_en,
    sourceQuotes,
    String(draftRule.value)
  )

  // Determine final explanation - use quote-only fallback if validation fails
  let finalExplanationHr = draftRule.explanation_hr
  let finalExplanationEn: string | null = draftRule.explanation_en ?? null

  if (!explanationValidation.valid) {
    console.warn(
      `[composer] Explanation validation failed for ${finalConceptSlug}:`,
      explanationValidation.errors
    )
    // FAIL-CLOSED: Use quote-only explanation when validation fails
    finalExplanationHr = createQuoteOnlyExplanation(sourceQuotes, String(draftRule.value))
    finalExplanationEn = null // Don't translate quote-only explanations
  } else if (explanationValidation.warnings.length > 0) {
    console.log(
      `[composer] Explanation warnings for ${finalConceptSlug}:`,
      explanationValidation.warnings
    )
  }

  // Store the draft rule in database
  const rule = await db.regulatoryRule.create({
    data: {
      conceptSlug: finalConceptSlug,
      titleHr: draftRule.title_hr,
      titleEn: draftRule.title_en,
      riskTier: draftRule.risk_tier,
      authorityLevel,
      appliesWhen: appliesWhenString,
      value: String(draftRule.value),
      valueType: draftRule.value_type,
      explanationHr: finalExplanationHr,
      explanationEn: finalExplanationEn,
      effectiveFrom: effectiveFromDate,
      effectiveUntil: effectiveUntilDate,
      supersedesId: draftRule.supersedes,
      status: "DRAFT",
      confidence: draftRule.llm_confidence, // LLM self-assessment (deprecated, kept for backward compatibility)
      llmConfidence: draftRule.llm_confidence, // LLM self-assessment
      derivedConfidence, // Issue #770: Evidence-based confidence from source pointers
      composerNotes: draftRule.composer_notes,
      meaningSignature,
      sourcePointers: {
        connect: validSourcePointerIds.map((id) => ({ id })),
      },
    },
  })

  // Create or update Concept for this rule (use canonical slug)
  const concept = await db.concept.upsert({
    where: { slug: finalConceptSlug },
    create: {
      slug: finalConceptSlug,
      nameHr: draftRule.title_hr,
      nameEn: draftRule.title_en,
      description: draftRule.explanation_hr,
      tags: [draftRule.risk_tier, authorityLevel],
    },
    update: {
      // Update names if they're longer/better
      nameHr: draftRule.title_hr,
      nameEn: draftRule.title_en,
    },
  })

  // Link rule to concept
  await db.regulatoryRule.update({
    where: { id: rule.id },
    data: { conceptId: concept.id },
  })

  // Create AMENDS edge if this rule supersedes another
  if (draftRule.supersedes) {
    try {
      await createEdgeWithCycleCheck({
        fromRuleId: rule.id,
        toRuleId: draftRule.supersedes,
        relation: "AMENDS",
        validFrom: rule.effectiveFrom,
      })
    } catch (error) {
      if (error instanceof CycleDetectedError) {
        console.warn(
          `[composer] Cycle prevented: AMENDS edge ${rule.id} -> ${draftRule.supersedes} would create a cycle`
        )
        // Don't fail rule creation, just skip the edge
      } else {
        throw error
      }
    }
  }

  // Run deterministic conflict detection
  const firstArticleNumber = sourcePointers.find((sp) => sp.articleNumber)?.articleNumber || null
  const conflicts = await detectStructuralConflicts({
    id: rule.id,
    conceptSlug: rule.conceptSlug,
    value: rule.value,
    effectiveFrom: rule.effectiveFrom,
    effectiveUntil: rule.effectiveUntil,
    authorityLevel,
    articleNumber: firstArticleNumber,
  })

  if (conflicts.length > 0) {
    const created = await seedConflicts(conflicts)
    console.log(
      `[composer] Detected ${conflicts.length} potential conflicts, created ${created} new conflict records`
    )
  }

  // Log audit event for rule creation
  // Issue #906: Include cross-source reference info for audit trail
  await logAuditEvent({
    action: "RULE_CREATED",
    entityType: "RULE",
    entityId: rule.id,
    metadata: {
      conceptSlug: rule.conceptSlug,
      riskTier: draftRule.risk_tier,
      confidence: draftRule.llm_confidence,
      llmConfidence: draftRule.llm_confidence, // LLM self-assessment
      derivedConfidence, // Issue #770: Evidence-based confidence
      sourcePointerCount: sourcePointerIds.length,
      conflictsDetected: conflicts.length,
      // Issue #906: Source attribution integrity
      primarySourceId: sourceConsistency.primarySourceId,
      crossSourceReferenceCount: sourceConsistency.crossSourceReferences.length,
      hasCrossSourceReferences: sourceConsistency.crossSourceReferences.length > 0,
    },
  })

  return {
    success: true,
    output: result.output,
    ruleId: rule.id,
    agentRunId: result.agentRunId ?? null,
    error: null,
  }
}

/**
 * Group source pointers by domain AND value for coherent rule creation.
 * This prevents mixing pointers for different concepts which leads to:
 * - Conflict detection failures
 * - LLM composition failures
 * - Orphaned pointers
 */
export function groupSourcePointersByDomain(
  sourcePointers: Array<{ id: string; domain: string; extractedValue?: string; valueType?: string }>
): Record<string, string[]> {
  const grouped: Record<string, string[]> = {}

  for (const sp of sourcePointers) {
    // Create a composite key: domain + normalized value + valueType
    // This ensures pointers with same concept/value are grouped together
    const normalizedValue = sp.extractedValue?.trim().toLowerCase() || "unknown"
    const valueType = sp.valueType || "text"
    const groupKey = `${sp.domain}::${valueType}::${normalizedValue}`

    if (!grouped[groupKey]) {
      grouped[groupKey] = []
    }
    grouped[groupKey].push(sp.id)
  }

  return grouped
}

// =============================================================================
// PHASE-D: COMPOSER PROPOSAL GENERATION (NO PERSISTENCE)
// =============================================================================

/** Grounding quote from CandidateFact */
interface GroundingQuote {
  text: string
  contextBefore?: string | null
  contextAfter?: string | null
  evidenceId?: string
  articleNumber?: string | null
  lawReference?: string | null
}

/**
 * Composer proposal - returned by generateComposerProposal()
 * Contains the LLM output without any persistence. Apply stage handles DB writes.
 */
export interface ComposerProposal {
  success: boolean
  output: ComposerOutput | null
  agentRunId: string | null
  candidateFactIds: string[]
  error: string | null
}

/**
 * PHASE-D: Generate a composer proposal from CandidateFacts (NO PERSISTENCE)
 *
 * This function:
 * 1. Fetches CandidateFacts by IDs
 * 2. Builds input for the composer agent
 * 3. Runs the LLM to generate a draft rule proposal
 * 4. Returns the proposal (ComposerOutput) without any DB writes
 *
 * Architecture: Composer generates proposals. Apply stage persists truth.
 * This ensures clean stage separation and auditability.
 */
export async function generateComposerProposal(
  candidateFactIds: string[],
  correlationOpts?: CorrelationOptions
): Promise<ComposerProposal> {
  if (candidateFactIds.length === 0) {
    return {
      success: false,
      output: null,
      agentRunId: null,
      candidateFactIds: [],
      error: "No candidate fact IDs provided",
    }
  }

  // Fetch CandidateFacts from database
  const candidateFacts = await db.candidateFact.findMany({
    where: { id: { in: candidateFactIds } },
  })

  if (candidateFacts.length === 0) {
    return {
      success: false,
      output: null,
      agentRunId: null,
      candidateFactIds,
      error: `No candidate facts found for IDs: ${candidateFactIds.join(", ")}`,
    }
  }

  console.log(
    `[composer] PHASE-D: Generating proposal from ${candidateFacts.length} CandidateFacts`
  )

  // Extract unique domains from candidate facts
  const domains = [...new Set(candidateFacts.map((cf) => cf.suggestedDomain).filter(Boolean))]
  const blockedDomains = domains.filter((d) => d && isBlockedDomain(d))
  if (blockedDomains.length > 0) {
    console.log(`[composer] Blocked test domains: ${blockedDomains.join(", ")}`)
    return {
      success: false,
      output: null,
      agentRunId: null,
      candidateFactIds,
      error: `Blocked domain(s): ${blockedDomains.join(", ")}. Test data cannot create rules.`,
    }
  }

  // Build input for the composer agent from CandidateFacts
  // Transform CandidateFacts into the format expected by ComposerInput
  const pointerLikeInputs = candidateFacts
    .map((cf) => {
      const quotes = cf.groundingQuotes as GroundingQuote[] | null
      if (!quotes || quotes.length === 0) {
        console.warn(`[composer] CandidateFact ${cf.id} has no grounding quotes, skipping`)
        return null
      }
      const primaryQuote = quotes[0]
      return {
        id: cf.id, // Use candidateFact ID as the "pointer" ID for input
        domain: cf.suggestedDomain || "unknown",
        extractedValue: cf.extractedValue || "",
        exactQuote: primaryQuote.text,
        confidence: cf.overallConfidence,
      }
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)

  if (pointerLikeInputs.length === 0) {
    return {
      success: false,
      output: null,
      agentRunId: null,
      candidateFactIds,
      error: "No valid CandidateFacts with grounding quotes",
    }
  }

  // Build input for agent (using candidateFact IDs as source pointer IDs for the LLM)
  const input: ComposerInput = {
    sourcePointerIds: pointerLikeInputs.map((p) => p.id),
    sourcePointers: pointerLikeInputs,
  }

  // Run the agent (LLM only - no persistence)
  const result = await runAgent<ComposerInput, ComposerOutput>({
    agentType: "COMPOSER",
    input,
    inputSchema: ComposerInputSchema,
    outputSchema: ComposerOutputSchema,
    temperature: 0.1,
    runId: correlationOpts?.runId,
    jobId: correlationOpts?.jobId,
    parentJobId: correlationOpts?.parentJobId,
    sourceSlug: correlationOpts?.sourceSlug,
    queueName: correlationOpts?.queueName ?? "compose",
  })

  if (!result.success || !result.output) {
    return {
      success: false,
      output: null,
      agentRunId: result.agentRunId ?? null,
      candidateFactIds,
      error: result.error,
    }
  }

  // Return the proposal - NO persistence here
  // Apply stage will handle SourcePointer + RegulatoryRule creation
  return {
    success: true,
    output: result.output,
    agentRunId: result.agentRunId ?? null,
    candidateFactIds,
    error: null,
  }
}

// =============================================================================
// PHASE-D: APPLY COMPOSER PROPOSAL (PERSISTENCE STAGE)
// =============================================================================

/**
 * Apply result - returned by applyComposerProposal()
 */
export interface ApplyResult {
  success: boolean
  ruleId: string | null
  sourcePointerIds: string[]
  error: string | null
}

/**
 * PHASE-D: Apply a composer proposal (PERSISTENCE STAGE)
 *
 * This function handles ALL persistence:
 * 1. Creates SourcePointers from CandidateFacts
 * 2. Creates RegulatoryRule from the proposal
 * 3. Links SourcePointers to the rule
 * 4. Updates CandidateFact status
 *
 * Architecture: This is the single point of truth persistence.
 * Separates "proposal generation" (compose) from "truth persistence" (apply).
 */
export async function applyComposerProposal(
  proposal: ComposerProposal,
  correlationOpts?: CorrelationOptions
): Promise<ApplyResult> {
  if (!proposal.success || !proposal.output) {
    return {
      success: false,
      ruleId: null,
      sourcePointerIds: [],
      error: proposal.error || "Invalid proposal",
    }
  }

  const { candidateFactIds, output } = proposal

  // Fetch CandidateFacts to create SourcePointers
  const candidateFacts = await db.candidateFact.findMany({
    where: { id: { in: candidateFactIds } },
  })

  if (candidateFacts.length === 0) {
    return {
      success: false,
      ruleId: null,
      sourcePointerIds: [],
      error: "No candidate facts found for apply",
    }
  }

  // Check for conflicts in the proposal
  if (output.conflicts_detected) {
    // Create a conflict record for Arbiter to resolve later
    const conflict = await db.regulatoryConflict.create({
      data: {
        conflictType: "SOURCE_CONFLICT",
        status: "OPEN",
        itemAId: null,
        itemBId: null,
        description:
          output.conflicts_detected.description || "Conflicting values detected in source data",
        metadata: {
          candidateFactIds,
          conflictingIds: candidateFactIds.slice(0, 2),
          detectedBy: "COMPOSER",
          conflictDetails: output.conflicts_detected,
        },
      },
    })

    await logAuditEvent({
      action: "CONFLICT_CREATED",
      entityType: "CONFLICT",
      entityId: conflict.id,
      metadata: {
        conflictType: "SOURCE_CONFLICT",
        candidateFactCount: candidateFactIds.length,
      },
    })

    console.log(`[apply] Created conflict ${conflict.id} for Arbiter resolution`)

    return {
      success: false,
      ruleId: null,
      sourcePointerIds: [],
      error: `Conflict detected (${conflict.id}) - queued for Arbiter`,
    }
  }

  const draftRule = output.draft_rule

  // Create SourcePointers from CandidateFacts
  const createdSourcePointerIds: string[] = []

  for (const cf of candidateFacts) {
    const quotes = cf.groundingQuotes as GroundingQuote[] | null
    if (!quotes || quotes.length === 0) {
      console.warn(`[apply] CandidateFact ${cf.id} has no grounding quotes, skipping`)
      continue
    }

    const primaryQuote = quotes[0]
    if (!primaryQuote.evidenceId) {
      console.warn(`[apply] CandidateFact ${cf.id} quote has no evidenceId, skipping`)
      continue
    }

    try {
      // Idempotency check: skip if SourcePointer already exists for this CandidateFact
      // This prevents duplicates on job retry
      const existingPointer = await db.sourcePointer.findFirst({
        where: {
          extractionNotes: { contains: `CandidateFact ${cf.id}` },
        },
      })

      if (existingPointer) {
        createdSourcePointerIds.push(existingPointer.id)
        console.log(
          `[apply] Found existing SourcePointer ${existingPointer.id} for CandidateFact ${cf.id} (idempotent)`
        )
        continue
      }

      const sourcePointer = await db.sourcePointer.create({
        data: {
          evidenceId: primaryQuote.evidenceId,
          domain: cf.suggestedDomain || "unknown",
          valueType: cf.suggestedValueType || "text",
          extractedValue: cf.extractedValue || "",
          displayValue: cf.extractedValue || "",
          exactQuote: primaryQuote.text,
          confidence: cf.overallConfidence,
          articleNumber: primaryQuote.articleNumber,
          lawReference: primaryQuote.lawReference,
          contextBefore: primaryQuote.contextBefore,
          contextAfter: primaryQuote.contextAfter,
          extractionNotes: `PHASE-D Apply: Created from CandidateFact ${cf.id}`,
        },
      })
      createdSourcePointerIds.push(sourcePointer.id)
      console.log(`[apply] Created SourcePointer ${sourcePointer.id} from CandidateFact ${cf.id}`)
    } catch (error) {
      console.error(`[apply] Failed to create SourcePointer from CandidateFact ${cf.id}:`, error)
    }
  }

  if (createdSourcePointerIds.length === 0) {
    return {
      success: false,
      ruleId: null,
      sourcePointerIds: [],
      error: "No SourcePointers could be created from CandidateFacts",
    }
  }

  // Validate AppliesWhen DSL
  let appliesWhenObj: unknown
  if (typeof draftRule.applies_when === "string") {
    try {
      appliesWhenObj = JSON.parse(draftRule.applies_when)
    } catch {
      appliesWhenObj = null
    }
  } else {
    appliesWhenObj = draftRule.applies_when
  }

  const dslValidation = validateAppliesWhen(appliesWhenObj)
  if (!dslValidation.valid) {
    console.error(`[apply] REJECTING rule with invalid AppliesWhen DSL: ${draftRule.concept_slug}`)
    await markOrphanedPointersForReview(
      createdSourcePointerIds,
      `Invalid DSL: ${dslValidation.error}`
    )
    return {
      success: false,
      ruleId: null,
      sourcePointerIds: createdSourcePointerIds,
      error: `Invalid AppliesWhen DSL: ${dslValidation.error}`,
    }
  }

  const appliesWhenString =
    typeof appliesWhenObj === "string" ? appliesWhenObj : JSON.stringify(appliesWhenObj)

  // Fetch evidence for authority level derivation
  const sourcePointers = await db.sourcePointer.findMany({
    where: { id: { in: createdSourcePointerIds } },
  })

  const evidenceIds = sourcePointers.map((sp) => sp.evidenceId)
  const evidenceRecords = await dbReg.evidence.findMany({
    where: { id: { in: evidenceIds } },
    include: { source: true },
  })

  const sourceSlugs = evidenceRecords
    .map((e) => e.source?.slug)
    .filter((slug): slug is string => slug !== undefined)
  const authorityLevel = deriveAuthorityLevel(sourceSlugs)

  // Check for deduplication
  const resolution = await resolveCanonicalConcept(
    draftRule.concept_slug,
    String(draftRule.value),
    draftRule.value_type,
    new Date(draftRule.effective_from)
  )

  if (resolution.shouldMerge && resolution.existingRuleId) {
    console.log(`[apply] Found existing rule ${resolution.existingRuleId}. Merging pointers.`)

    const mergeResult = await mergePointersToExistingRule(
      resolution.existingRuleId,
      createdSourcePointerIds
    )

    await logAuditEvent({
      action: "RULE_MERGED",
      entityType: "RULE",
      entityId: resolution.existingRuleId,
      metadata: {
        proposedSlug: draftRule.concept_slug,
        canonicalSlug: resolution.canonicalSlug,
        addedPointers: mergeResult.addedPointers,
        reason: resolution.mergeReason,
      },
    })

    // Update CandidateFact status
    await db.candidateFact.updateMany({
      where: { id: { in: candidateFactIds } },
      data: {
        status: "PROMOTED",
        promotedToRuleFactId: resolution.existingRuleId,
        reviewedAt: new Date(),
      },
    })

    return {
      success: true,
      ruleId: resolution.existingRuleId,
      sourcePointerIds: createdSourcePointerIds,
      error: null,
    }
  }

  const finalConceptSlug = resolution.canonicalSlug

  // Compute meaning signature
  const effectiveFromDate = new Date(draftRule.effective_from)
  const effectiveUntilDate = draftRule.effective_until ? new Date(draftRule.effective_until) : null
  const meaningSignature = computeMeaningSignature({
    conceptSlug: finalConceptSlug,
    value: String(draftRule.value),
    valueType: draftRule.value_type,
    effectiveFrom: effectiveFromDate,
    effectiveUntil: effectiveUntilDate,
  })

  // Compute derived confidence
  const derivedConfidence = computeDerivedConfidence(
    sourcePointers.map((sp) => ({ confidence: sp.confidence })),
    draftRule.llm_confidence
  )

  // Validate explanation
  const pointersWithQuotes = await db.sourcePointer.findMany({
    where: { id: { in: createdSourcePointerIds } },
    select: { exactQuote: true },
  })
  const sourceQuotes = pointersWithQuotes.map((p) => p.exactQuote).filter(Boolean) as string[]
  const explanationValidation = validateExplanation(
    draftRule.explanation_hr,
    draftRule.explanation_en,
    sourceQuotes,
    String(draftRule.value)
  )

  let finalExplanationHr = draftRule.explanation_hr
  let finalExplanationEn: string | null = draftRule.explanation_en ?? null

  if (!explanationValidation.valid) {
    console.warn(`[apply] Explanation validation failed for ${finalConceptSlug}`)
    finalExplanationHr = createQuoteOnlyExplanation(sourceQuotes, String(draftRule.value))
    finalExplanationEn = null
  }

  // Create the RegulatoryRule
  const rule = await db.regulatoryRule.create({
    data: {
      conceptSlug: finalConceptSlug,
      titleHr: draftRule.title_hr,
      titleEn: draftRule.title_en,
      riskTier: draftRule.risk_tier,
      authorityLevel,
      appliesWhen: appliesWhenString,
      value: String(draftRule.value),
      valueType: draftRule.value_type,
      explanationHr: finalExplanationHr,
      explanationEn: finalExplanationEn,
      effectiveFrom: effectiveFromDate,
      effectiveUntil: effectiveUntilDate,
      supersedesId: draftRule.supersedes,
      status: "DRAFT",
      confidence: draftRule.llm_confidence,
      llmConfidence: draftRule.llm_confidence,
      derivedConfidence,
      composerNotes: draftRule.composer_notes,
      meaningSignature,
      sourcePointers: {
        connect: createdSourcePointerIds.map((id) => ({ id })),
      },
    },
  })

  // Create/update Concept
  const concept = await db.concept.upsert({
    where: { slug: finalConceptSlug },
    create: {
      slug: finalConceptSlug,
      nameHr: draftRule.title_hr,
      nameEn: draftRule.title_en,
      description: draftRule.explanation_hr,
      tags: [draftRule.risk_tier, authorityLevel],
    },
    update: {
      nameHr: draftRule.title_hr,
      nameEn: draftRule.title_en,
    },
  })

  await db.regulatoryRule.update({
    where: { id: rule.id },
    data: { conceptId: concept.id },
  })

  // Create AMENDS edge if superseding
  if (draftRule.supersedes) {
    try {
      await createEdgeWithCycleCheck({
        fromRuleId: rule.id,
        toRuleId: draftRule.supersedes,
        relation: "AMENDS",
        validFrom: rule.effectiveFrom,
      })
    } catch (error) {
      if (error instanceof CycleDetectedError) {
        console.warn(`[apply] Cycle prevented: AMENDS edge would create a cycle`)
      } else {
        throw error
      }
    }
  }

  // Detect conflicts
  const firstArticleNumber = sourcePointers.find((sp) => sp.articleNumber)?.articleNumber || null
  const conflicts = await detectStructuralConflicts({
    id: rule.id,
    conceptSlug: rule.conceptSlug,
    value: rule.value,
    effectiveFrom: rule.effectiveFrom,
    effectiveUntil: rule.effectiveUntil,
    authorityLevel,
    articleNumber: firstArticleNumber,
  })

  if (conflicts.length > 0) {
    const created = await seedConflicts(conflicts)
    console.log(`[apply] Detected ${conflicts.length} conflicts, created ${created} records`)
  }

  // Log audit event
  await logAuditEvent({
    action: "RULE_CREATED",
    entityType: "RULE",
    entityId: rule.id,
    metadata: {
      conceptSlug: rule.conceptSlug,
      riskTier: draftRule.risk_tier,
      llmConfidence: draftRule.llm_confidence,
      derivedConfidence,
      sourcePointerCount: createdSourcePointerIds.length,
      candidateFactCount: candidateFactIds.length,
      conflictsDetected: conflicts.length,
    },
  })

  // Update CandidateFact status
  await db.candidateFact.updateMany({
    where: { id: { in: candidateFactIds } },
    data: {
      status: "PROMOTED",
      promotedToRuleFactId: rule.id,
      reviewedAt: new Date(),
    },
  })

  console.log(
    `[apply] Created rule ${rule.id} with ${createdSourcePointerIds.length} SourcePointers`
  )

  return {
    success: true,
    ruleId: rule.id,
    sourcePointerIds: createdSourcePointerIds,
    error: null,
  }
}

/**
 * @deprecated Use generateComposerProposal() + applyComposerProposal() instead.
 * This function is kept for backward compatibility during migration.
 */
export async function runComposerFromCandidates(
  candidateFactIds: string[],
  correlationOpts?: CorrelationOptions
): Promise<ComposerResult> {
  // Generate proposal (LLM only)
  const proposal = await generateComposerProposal(candidateFactIds, correlationOpts)

  if (!proposal.success) {
    return {
      success: false,
      output: proposal.output,
      ruleId: null,
      agentRunId: proposal.agentRunId,
      error: proposal.error,
    }
  }

  // Apply proposal (persistence)
  const applyResult = await applyComposerProposal(proposal, correlationOpts)

  return {
    success: applyResult.success,
    output: proposal.output,
    ruleId: applyResult.ruleId,
    agentRunId: proposal.agentRunId,
    error: applyResult.error,
  }
}

/**
 * Mark orphaned pointers for manual review or retry.
 * This handles pointers that failed composition due to conflicts or validation errors.
 */
export async function markOrphanedPointersForReview(
  pointerIds: string[],
  reason: string
): Promise<void> {
  if (pointerIds.length === 0) return

  // Add extractionNotes to indicate why composition failed
  const timestamp = new Date().toISOString()
  await db.sourcePointer.updateMany({
    where: { id: { in: pointerIds } },
    data: {
      extractionNotes: `[COMPOSITION_FAILED @ ${timestamp}] ${reason}. Needs manual review or retry.`,
    },
  })

  console.log(`[composer] Marked ${pointerIds.length} orphaned pointers for review: ${reason}`)
}

/**
 * Run composer on all ungrouped source pointers
 */
export async function runComposerBatch(): Promise<{
  success: number
  failed: number
  totalRules: number
  errors: string[]
}> {
  // Find source pointers that are not yet linked to any rule
  const ungroupedPointers = await db.sourcePointer.findMany({
    where: {
      rules: {
        none: {},
      },
    },
    select: {
      id: true,
      domain: true,
      extractedValue: true,
      valueType: true,
    },
  })

  if (ungroupedPointers.length === 0) {
    return { success: 0, failed: 0, totalRules: 0, errors: [] }
  }

  // Group by domain
  const grouped = groupSourcePointersByDomain(ungroupedPointers)

  let success = 0
  let failed = 0
  let totalRules = 0
  const errors: string[] = []

  // Process each domain group
  for (const [domain, pointerIds] of Object.entries(grouped)) {
    console.log(`[composer] Processing domain: ${domain} (${pointerIds.length} pointers)`)

    // Use soft-fail wrapper to prevent single failures from blocking entire batch
    const softFailResult = await withSoftFail(() => runComposer(pointerIds), null, {
      operation: "composer_batch",
      entityType: "source",
      metadata: {
        domain,
        pointerCount: pointerIds.length,
        pointerIds: pointerIds.slice(0, 5), // Log first 5 IDs only
      },
    })

    if (softFailResult.success && softFailResult.data?.success && softFailResult.data.ruleId) {
      success++
      totalRules++
      console.log(`[composer] ✓ Created/merged rule: ${softFailResult.data.ruleId}`)
    } else {
      failed++
      const errorMsg = softFailResult.error || softFailResult.data?.error || "Unknown error"
      errors.push(`${domain}: ${errorMsg}`)
      console.log(`[composer] ✗ ${domain}: ${errorMsg}`)

      // Mark these pointers for manual review since composition failed
      await markOrphanedPointersForReview(pointerIds, errorMsg)
    }

    // Rate limiting - wait 3 seconds between compositions
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }

  return { success, failed, totalRules, errors }
}
