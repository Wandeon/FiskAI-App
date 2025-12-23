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

  // Validate AppliesWhen DSL before storing
  const dslValidation = validateAppliesWhen(draftRule.applies_when)
  if (!dslValidation.valid) {
    console.warn(
      `[composer] Invalid AppliesWhen DSL for ${draftRule.concept_slug}: ${dslValidation.error}`
    )
    console.warn(`[composer] Replacing with { op: "true" } as fallback`)

    // Replace invalid DSL with safe default
    draftRule.applies_when = { op: "true" } as any

    // Add note about the fix
    draftRule.composer_notes = `${draftRule.composer_notes || ""}\n[AUTO-FIX] Original appliesWhen was invalid: ${dslValidation.error}`
  }

  // Derive authority level from sources
  const sourceSlugs = sourcePointers
    .filter((sp) => sp.evidence?.source?.slug)
    .map((sp) => sp.evidence.source.slug)
  const authorityLevel = deriveAuthorityLevel(sourceSlugs)

  // IMPORTANT: Use the actual input source pointer IDs, not the LLM output
  // The LLM sometimes hallucinates IDs that don't exist in the database
  const validSourcePointerIds = sourcePointerIds
  console.log(
    `[composer] Linking ${validSourcePointerIds.length} source pointers (LLM returned ${draftRule.source_pointer_ids?.length || 0})`
  )

  // Store the draft rule in database
  const rule = await db.regulatoryRule.create({
    data: {
      conceptSlug: draftRule.concept_slug,
      titleHr: draftRule.title_hr,
      titleEn: draftRule.title_en,
      riskTier: draftRule.risk_tier,
      authorityLevel,
      appliesWhen: draftRule.applies_when,
      value: String(draftRule.value),
      valueType: draftRule.value_type,
      explanationHr: draftRule.explanation_hr,
      explanationEn: draftRule.explanation_en,
      effectiveFrom: new Date(draftRule.effective_from),
      effectiveUntil: draftRule.effective_until ? new Date(draftRule.effective_until) : null,
      supersedesId: draftRule.supersedes,
      status: "DRAFT",
      confidence: draftRule.confidence,
      composerNotes: draftRule.composer_notes,
      sourcePointers: {
        connect: validSourcePointerIds.map((id) => ({ id })),
      },
    },
  })

  // Create or update Concept for this rule
  const concept = await db.concept.upsert({
    where: { slug: draftRule.concept_slug },
    create: {
      slug: draftRule.concept_slug,
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
    await db.graphEdge.create({
      data: {
        fromRuleId: rule.id,
        toRuleId: draftRule.supersedes,
        relation: "AMENDS",
        validFrom: rule.effectiveFrom,
      },
    })
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

    try {
      const result = await runComposer(pointerIds)

      if (result.success && result.ruleId) {
        success++
        totalRules++
        console.log(`[composer] ✓ Created rule: ${result.ruleId}`)
      } else {
        failed++
        const errorMsg = `${domain}: ${result.error}`
        errors.push(errorMsg)
        console.log(`[composer] ✗ ${errorMsg}`)
      }
    } catch (error) {
      failed++
      const errorMsg = `${domain}: ${error}`
      errors.push(errorMsg)
      console.error(`[composer] ✗ ${errorMsg}`)
    }

    // Rate limiting - wait 3 seconds between compositions
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }

  return { success, failed, totalRules, errors }
}
