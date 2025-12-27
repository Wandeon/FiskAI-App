// src/lib/regulatory-truth/graph/knowledge-graph.ts
// Knowledge Graph Builder - Populates Concept hierarchy and Rule relationships

import { db } from "@/lib/db"
import type { GraphEdgeType } from "@prisma/client"
import { logAuditEvent } from "../utils/audit-log"
import { createEdgeWithCycleCheck, CycleDetectedError } from "./cycle-detection"

export interface GraphBuildResult {
  conceptsCreated: number
  conceptsLinked: number
  edgesCreated: number
  errors: string[]
}

/**
 * Domain hierarchy for Croatian regulatory concepts
 */
const CONCEPT_HIERARCHY: Record<string, string[]> = {
  // Top-level domains
  porez: ["pdv", "porez-dohodak", "porez-dobit", "pausalni"],
  doprinosi: ["mirovinsko", "zdravstveno", "zaposljavanja"],
  fiskalizacija: ["racuni", "blagajna", "certifikati"],
  rokovi: ["placanja", "prijave", "izvjestaji"],
  obrasci: ["joppd", "pdv-obrasci", "godisnji"],

  // PDV sub-hierarchy
  pdv: ["pdv-stopa", "pdv-oslobodenje", "pdv-povrat"],

  // Pausalni sub-hierarchy
  pausalni: ["pausalni-prag", "pausalni-postotak", "pausalni-evidencije"],

  // Doprinosi sub-hierarchy
  mirovinsko: ["mirovina-stopa", "mirovina-osnovica", "mirovina-staz"],
  zdravstveno: ["zdravstveno-stopa", "zdravstveno-naknada"],
}

/**
 * Build concept hierarchy from domain relationships
 */
export async function buildConceptHierarchy(): Promise<{
  created: number
  linked: number
  errors: string[]
}> {
  const results = { created: 0, linked: 0, errors: [] as string[] }

  for (const [parentSlug, childSlugs] of Object.entries(CONCEPT_HIERARCHY)) {
    try {
      // Ensure parent concept exists
      const parent = await db.concept.upsert({
        where: { slug: parentSlug },
        create: {
          slug: parentSlug,
          nameHr: formatConceptName(parentSlug),
          nameEn: formatConceptNameEn(parentSlug),
          tags: ["domain"],
        },
        update: {},
      })

      // Link child concepts
      for (const childSlug of childSlugs) {
        try {
          await db.concept.upsert({
            where: { slug: childSlug },
            create: {
              slug: childSlug,
              nameHr: formatConceptName(childSlug),
              nameEn: formatConceptNameEn(childSlug),
              parentId: parent.id,
              tags: ["subdomain"],
            },
            update: {
              parentId: parent.id,
            },
          })
          results.linked++
        } catch (error) {
          results.errors.push(
            `Failed to link ${childSlug} to ${parentSlug}: ${error instanceof Error ? error.message : String(error)}`
          )
        }
      }

      results.created++
    } catch (error) {
      results.errors.push(
        `Failed to create parent ${parentSlug}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  console.log(
    `[graph] Concept hierarchy: ${results.created} parents, ${results.linked} children linked`
  )
  return results
}

/**
 * Build edges between rules based on their relationships
 */
export async function buildRuleEdges(): Promise<{
  created: number
  errors: string[]
}> {
  const results = { created: 0, errors: [] as string[] }

  // Get all published/approved rules
  const rules = await db.regulatoryRule.findMany({
    where: {
      status: { in: ["PUBLISHED", "APPROVED"] },
    },
    select: {
      id: true,
      conceptSlug: true,
      effectiveFrom: true,
      effectiveUntil: true,
      supersedesId: true,
      appliesWhen: true,
    },
  })

  // Group rules by concept
  const rulesBySlug: Record<string, typeof rules> = {}
  for (const rule of rules) {
    if (!rulesBySlug[rule.conceptSlug]) {
      rulesBySlug[rule.conceptSlug] = []
    }
    rulesBySlug[rule.conceptSlug].push(rule)
  }

  // Create SUPERSEDES edges for temporal succession
  for (const [conceptSlug, conceptRules] of Object.entries(rulesBySlug)) {
    // Sort by effective date
    const sorted = conceptRules.sort(
      (a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime()
    )

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i]
      const previous = sorted[i - 1]

      // Check if there's already a supersedes relationship
      if (current.supersedesId === previous.id) continue

      // Check if edge already exists
      const existingEdge = await db.graphEdge.findFirst({
        where: {
          fromRuleId: current.id,
          toRuleId: previous.id,
          relation: "SUPERSEDES",
        },
      })

      if (!existingEdge) {
        try {
          await createEdgeWithCycleCheck({
            fromRuleId: current.id,
            toRuleId: previous.id,
            relation: "SUPERSEDES",
            validFrom: current.effectiveFrom,
            notes: `Auto-generated: ${conceptSlug} temporal succession`,
          })
          results.created++
        } catch (error) {
          // Skip duplicate errors and log cycle detection errors
          if (error instanceof CycleDetectedError) {
            results.errors.push(
              `Cycle prevented: SUPERSEDES edge ${current.id} -> ${previous.id} would create a cycle`
            )
          } else if (!String(error).includes("Unique constraint")) {
            results.errors.push(`Edge ${current.id} -> ${previous.id}: ${error}`)
          }
        }
      }
    }
  }

  // Analyze appliesWhen for DEPENDS_ON relationships
  for (const rule of rules) {
    const dependencies = extractDependencies(rule.appliesWhen)

    for (const depSlug of dependencies) {
      // Find the current rule for this dependency
      const depRules = rulesBySlug[depSlug]
      if (!depRules || depRules.length === 0) continue

      // Get the most recent valid rule
      const depRule = depRules.find(
        (r) =>
          r.effectiveFrom <= new Date() && (!r.effectiveUntil || r.effectiveUntil >= new Date())
      )

      if (depRule && depRule.id !== rule.id) {
        const existingEdge = await db.graphEdge.findFirst({
          where: {
            fromRuleId: rule.id,
            toRuleId: depRule.id,
            relation: "DEPENDS_ON",
          },
        })

        if (!existingEdge) {
          try {
            await createEdgeWithCycleCheck({
              fromRuleId: rule.id,
              toRuleId: depRule.id,
              relation: "DEPENDS_ON",
              validFrom: rule.effectiveFrom,
              notes: `Auto-generated: appliesWhen references ${depSlug}`,
            })
            results.created++
          } catch (error) {
            if (error instanceof CycleDetectedError) {
              results.errors.push(
                `Cycle prevented: DEPENDS_ON edge ${rule.id} -> ${depRule.id} would create a cycle`
              )
            } else if (!String(error).includes("Unique constraint")) {
              results.errors.push(`Dependency edge ${rule.id} -> ${depRule.id}: ${error}`)
            }
          }
        }
      }
    }
  }

  console.log(`[graph] Rule edges: ${results.created} created`)
  return results
}

/**
 * Extract concept slugs referenced in appliesWhen DSL
 */
function extractDependencies(appliesWhen: string): string[] {
  const dependencies: string[] = []

  try {
    const parsed = JSON.parse(appliesWhen)

    // Look for field references that might be concept slugs
    const findRefs = (obj: unknown): void => {
      if (!obj || typeof obj !== "object") return

      if (Array.isArray(obj)) {
        obj.forEach(findRefs)
        return
      }

      const o = obj as Record<string, unknown>

      // Check for concept_ref or similar fields
      if (o.concept_ref && typeof o.concept_ref === "string") {
        dependencies.push(o.concept_ref)
      }

      // Check for rule_ref
      if (o.rule_ref && typeof o.rule_ref === "string") {
        dependencies.push(o.rule_ref)
      }

      // Recurse into nested objects
      Object.values(o).forEach(findRefs)
    }

    findRefs(parsed)
  } catch {
    // Not JSON, check for slug patterns
    const slugPattern = /[a-z]+-[a-z]+(?:-[a-z]+)*/g
    const matches = appliesWhen.match(slugPattern)
    if (matches) {
      dependencies.push(...matches)
    }
  }

  return [...new Set(dependencies)]
}

/**
 * Link rules to their concepts
 */
export async function linkRulesToConcepts(): Promise<{
  linked: number
  errors: string[]
}> {
  const results = { linked: 0, errors: [] as string[] }

  // Find rules without concept links
  const unlinkedRules = await db.regulatoryRule.findMany({
    where: { conceptId: null },
    select: { id: true, conceptSlug: true },
  })

  for (const rule of unlinkedRules) {
    // Extract base concept from slug (e.g., "payment-deadline-2025" -> "payment-deadline")
    const baseConcept = extractBaseConcept(rule.conceptSlug)

    try {
      // Find or create concept
      const concept = await db.concept.upsert({
        where: { slug: baseConcept },
        create: {
          slug: baseConcept,
          nameHr: formatConceptName(baseConcept),
          nameEn: formatConceptNameEn(baseConcept),
          tags: ["auto-created"],
        },
        update: {},
      })

      await db.regulatoryRule.update({
        where: { id: rule.id },
        data: { conceptId: concept.id },
      })

      results.linked++
    } catch (error) {
      results.errors.push(
        `Failed to link ${rule.id} to ${baseConcept}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  console.log(`[graph] Linked ${results.linked} rules to concepts`)
  return results
}

/**
 * Extract base concept from a rule slug
 * e.g., "payment-deadline-2025" -> "payment-deadline"
 */
function extractBaseConcept(slug: string): string {
  // Remove trailing year patterns
  return slug.replace(/-\d{4}$/, "").replace(/-\d{4}-\d{2}$/, "")
}

/**
 * Format concept slug to Croatian name
 */
function formatConceptName(slug: string): string {
  const translations: Record<string, string> = {
    porez: "Porez",
    pdv: "PDV (Porez na dodanu vrijednost)",
    "porez-dohodak": "Porez na dohodak",
    "porez-dobit": "Porez na dobit",
    pausalni: "Paušalno oporezivanje",
    doprinosi: "Doprinosi",
    mirovinsko: "Mirovinsko osiguranje",
    zdravstveno: "Zdravstveno osiguranje",
    zaposljavanja: "Doprinos za zapošljavanje",
    fiskalizacija: "Fiskalizacija",
    rokovi: "Rokovi",
    obrasci: "Obrasci",
    placanja: "Plaćanja",
    prijave: "Prijave",
    izvjestaji: "Izvještaji",
  }

  return translations[slug] || slug.split("-").map(capitalize).join(" ")
}

/**
 * Format concept slug to English name
 */
function formatConceptNameEn(slug: string): string {
  const translations: Record<string, string> = {
    porez: "Tax",
    pdv: "VAT (Value Added Tax)",
    "porez-dohodak": "Income Tax",
    "porez-dobit": "Corporate Tax",
    pausalni: "Flat-rate Taxation",
    doprinosi: "Contributions",
    mirovinsko: "Pension Insurance",
    zdravstveno: "Health Insurance",
    zaposljavanja: "Employment Contribution",
    fiskalizacija: "Fiscalization",
    rokovi: "Deadlines",
    obrasci: "Forms",
    placanja: "Payments",
    prijave: "Filings",
    izvjestaji: "Reports",
  }

  return translations[slug] || slug.split("-").map(capitalize).join(" ")
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Full knowledge graph build - run all steps
 */
export async function buildKnowledgeGraph(): Promise<GraphBuildResult> {
  console.log("\n[graph] Building knowledge graph...")

  const result: GraphBuildResult = {
    conceptsCreated: 0,
    conceptsLinked: 0,
    edgesCreated: 0,
    errors: [],
  }

  // Step 1: Build concept hierarchy
  const hierarchyResult = await buildConceptHierarchy()
  result.conceptsCreated += hierarchyResult.created
  result.conceptsLinked += hierarchyResult.linked
  result.errors.push(...hierarchyResult.errors)

  // Step 2: Link rules to concepts
  const linkResult = await linkRulesToConcepts()
  result.conceptsLinked += linkResult.linked
  result.errors.push(...linkResult.errors)

  // Step 3: Build rule edges
  const edgeResult = await buildRuleEdges()
  result.edgesCreated += edgeResult.created
  result.errors.push(...edgeResult.errors)

  // Log audit event
  await logAuditEvent({
    action: "CONCEPT_CREATED", // Using existing enum value
    entityType: "RELEASE", // Graph build is a release-level event
    entityId: "knowledge-graph",
    metadata: {
      conceptsCreated: result.conceptsCreated,
      conceptsLinked: result.conceptsLinked,
      edgesCreated: result.edgesCreated,
      errorCount: result.errors.length,
    },
  })

  console.log(
    `[graph] Complete: ${result.conceptsCreated} concepts, ${result.conceptsLinked} links, ${result.edgesCreated} edges`
  )

  return result
}
