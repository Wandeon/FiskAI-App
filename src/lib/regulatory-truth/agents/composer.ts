// src/lib/regulatory-truth/agents/composer.ts

import { db } from "@/lib/db"
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

// =============================================================================
// COMPOSER AGENT
// =============================================================================

export interface ComposerResult {
  success: boolean
  output: ComposerOutput | null
  ruleId: string | null
  error: string | null
}

/**
 * Run the Composer agent to create Draft Rules from SourcePointers
 */
export async function runComposer(sourcePointerIds: string[]): Promise<ComposerResult> {
  if (sourcePointerIds.length === 0) {
    return {
      success: false,
      output: null,
      ruleId: null,
      error: "No source pointer IDs provided",
    }
  }

  // Get source pointers from database
  const sourcePointers = await db.sourcePointer.findMany({
    where: { id: { in: sourcePointerIds } },
    include: {
      evidence: {
        include: {
          source: true,
        },
      },
    },
  })

  if (sourcePointers.length === 0) {
    return {
      success: false,
      output: null,
      ruleId: null,
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
      error: `Blocked domain(s): ${blockedDomains.join(", ")}. Test data cannot create rules.`,
    }
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
  })

  if (!result.success || !result.output) {
    return {
      success: false,
      output: null,
      ruleId: null,
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
      error: `Cannot create rule "${draftRule.concept_slug}" with invalid AppliesWhen DSL: ${dslValidation.error}. Rules with invalid applicability conditions must be rejected to prevent incorrect application.`,
    }
  }

  // Serialize appliesWhen to JSON string for database storage
  const appliesWhenString =
    typeof appliesWhenObj === "string" ? appliesWhenObj : JSON.stringify(appliesWhenObj)

  // Derive authority level from sources
  const sourceSlugs = sourcePointers
    .filter((sp) => sp.evidence?.source?.slug)
    .map((sp) => sp.evidence.source.slug)
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
      confidence: draftRule.confidence,
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
  await logAuditEvent({
    action: "RULE_CREATED",
    entityType: "RULE",
    entityId: rule.id,
    metadata: {
      conceptSlug: rule.conceptSlug,
      riskTier: draftRule.risk_tier,
      confidence: draftRule.confidence,
      sourcePointerCount: sourcePointerIds.length,
      conflictsDetected: conflicts.length,
    },
  })

  return {
    success: true,
    output: result.output,
    ruleId: rule.id,
    error: null,
  }
}

/**
 * Group source pointers by domain for coherent rule creation
 */
export function groupSourcePointersByDomain(
  sourcePointers: Array<{ id: string; domain: string }>
): Record<string, string[]> {
  const grouped: Record<string, string[]> = {}

  for (const sp of sourcePointers) {
    if (!grouped[sp.domain]) {
      grouped[sp.domain] = []
    }
    grouped[sp.domain].push(sp.id)
  }

  return grouped
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
      console.log(`[composer] ✓ Created rule: ${softFailResult.data.ruleId}`)
    } else {
      failed++
      const errorMsg = softFailResult.error || softFailResult.data?.error || "Unknown error"
      errors.push(`${domain}: ${errorMsg}`)
      console.log(`[composer] ✗ ${domain}: ${errorMsg}`)
    }

    // Rate limiting - wait 3 seconds between compositions
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }

  return { success, failed, totalRules, errors }
}
