#!/usr/bin/env npx tsx

/**
 * Lists all RegulatoryRule conceptIds that are missing from CONCEPT_REGISTRY.
 *
 * This script helps identify gaps in the content sync system by finding
 * conceptIds that would cause UnmappedConceptError and dead-letter events.
 *
 * Usage: npx tsx scripts/list-unmapped-concepts.ts
 */

// IMPORTANT: Load environment variables BEFORE any imports that might use them
import { config } from "dotenv"
import { resolve } from "path"
const envPath = resolve(process.cwd(), ".env.local")
config({ path: envPath })

// Now import modules that depend on env vars
import { db } from "../src/lib/db"
import { getAllConceptIds } from "../src/lib/regulatory-truth/content-sync/concept-registry"

interface UnmappedConceptReport {
  conceptId: string
  ruleCount: number
  sampleRules: Array<{
    id: string
    titleHr: string
    status: string
    effectiveFrom: Date
  }>
}

async function listUnmappedConcepts() {
  console.log("Checking for unmapped concepts...\n")

  // Get all conceptIds from CONCEPT_REGISTRY
  const registeredIds = new Set(getAllConceptIds())
  console.log(`Found ${registeredIds.size} concepts in CONCEPT_REGISTRY`)

  // Get all distinct conceptIds from RegulatoryRule
  const rulesWithConcepts = await db.regulatoryRule.findMany({
    where: {
      conceptId: { not: null },
    },
    select: {
      id: true,
      conceptId: true,
      titleHr: true,
      status: true,
      effectiveFrom: true,
    },
    orderBy: {
      effectiveFrom: "desc",
    },
  })

  console.log(`Found ${rulesWithConcepts.length} rules with conceptIds in database\n`)

  // Group by conceptId
  const conceptMap = new Map<string, typeof rulesWithConcepts>()
  for (const rule of rulesWithConcepts) {
    if (!rule.conceptId) continue

    if (!conceptMap.has(rule.conceptId)) {
      conceptMap.set(rule.conceptId, [])
    }
    conceptMap.get(rule.conceptId)!.push(rule)
  }

  console.log(`Found ${conceptMap.size} distinct conceptIds in database\n`)

  // Find unmapped concepts
  const unmappedConcepts: UnmappedConceptReport[] = []

  for (const [conceptId, rules] of conceptMap) {
    if (!registeredIds.has(conceptId)) {
      unmappedConcepts.push({
        conceptId,
        ruleCount: rules.length,
        sampleRules: rules.slice(0, 3).map((r) => ({
          id: r.id,
          titleHr: r.titleHr,
          status: r.status,
          effectiveFrom: r.effectiveFrom,
        })),
      })
    }
  }

  // Sort by rule count (most rules first)
  unmappedConcepts.sort((a, b) => b.ruleCount - a.ruleCount)

  if (unmappedConcepts.length === 0) {
    console.log("✅ All conceptIds are mapped in CONCEPT_REGISTRY!")
    return
  }

  console.log(`❌ Found ${unmappedConcepts.length} UNMAPPED concepts:\n`)
  console.log("=" .repeat(80))

  let totalUnmappedRules = 0

  for (const concept of unmappedConcepts) {
    totalUnmappedRules += concept.ruleCount
    console.log(`\nConceptID: ${concept.conceptId}`)
    console.log(`Rules affected: ${concept.ruleCount}`)
    console.log(`Sample rules:`)
    for (const rule of concept.sampleRules) {
      console.log(
        `  - [${rule.status}] ${rule.titleHr} (${rule.effectiveFrom.toISOString().split("T")[0]})`
      )
    }
  }

  console.log("\n" + "=".repeat(80))
  console.log(`\nSummary:`)
  console.log(`  Total unmapped concepts: ${unmappedConcepts.length}`)
  console.log(`  Total rules affected: ${totalUnmappedRules}`)
  console.log(`  Registered concepts: ${registeredIds.size}`)
  console.log(`  Total concepts in DB: ${conceptMap.size}`)
  console.log(
    `  Coverage: ${(((conceptMap.size - unmappedConcepts.length) / conceptMap.size) * 100).toFixed(1)}%`
  )

  console.log(`\n⚠️  These concepts will cause DEAD_LETTERED events in content-sync!`)
  console.log(
    `\nTo fix: Add mappings for these conceptIds to src/lib/regulatory-truth/content-sync/concept-registry.ts`
  )

  process.exit(1)
}

listUnmappedConcepts()
  .catch((error) => {
    console.error("Error:", error)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
