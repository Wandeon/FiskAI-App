// scripts/analyze-not-found.ts
// Analyze remaining NOT_FOUND provenance failures

import "dotenv/config"
import { db, dbReg } from "../src/lib/db"

async function analyzeFailures() {
  // Get rules still in PENDING_REVIEW
  const pendingRules = await db.regulatoryRule.findMany({
    where: { status: "PENDING_REVIEW" },
    select: { id: true, conceptSlug: true, riskTier: true },
  })

  console.log("=== Analyzing", pendingRules.length, "PENDING_REVIEW rules ===\n")

  // Get source pointers for these rules
  const ruleIds = pendingRules.map((r) => r.id)
  const pointers = await db.sourcePointer.findMany({
    where: { rules: { some: { id: { in: ruleIds } } } },
    select: {
      id: true,
      evidenceId: true,
      matchType: true,
      exactQuote: true,
    },
  })

  console.log("Total source pointers:", pointers.length)

  // Group by matchType
  const byMatchType: Record<string, number> = {}
  for (const p of pointers) {
    const mt = p.matchType || "NULL"
    byMatchType[mt] = (byMatchType[mt] || 0) + 1
  }
  console.log("\nBy matchType:")
  for (const [mt, count] of Object.entries(byMatchType)) {
    console.log(`  ${mt}: ${count}`)
  }

  // Check evidence status for NOT_FOUND/PENDING pointers
  const problemPointers = pointers.filter(
    (p) => p.matchType === "NOT_FOUND" || p.matchType === "PENDING_VERIFICATION" || !p.matchType
  )
  const evidenceIds = [...new Set(problemPointers.map((p) => p.evidenceId))]

  console.log("\nProblem pointers:", problemPointers.length)
  console.log("Unique evidence IDs:", evidenceIds.length)

  // Check evidence details
  const evidenceList = await dbReg.evidence.findMany({
    where: { id: { in: evidenceIds } },
    select: {
      id: true,
      contentClass: true,
      url: true,
      primaryTextArtifactId: true,
      rawContent: true,
    },
  })

  // Categorize evidence
  const evidenceStats = {
    hasArtifact: 0,
    hasRawContent: 0,
    hasNeither: 0,
    byContentClass: {} as Record<string, number>,
  }

  for (const e of evidenceList) {
    if (e.primaryTextArtifactId) evidenceStats.hasArtifact++
    else if (e.rawContent) evidenceStats.hasRawContent++
    else evidenceStats.hasNeither++

    evidenceStats.byContentClass[e.contentClass] =
      (evidenceStats.byContentClass[e.contentClass] || 0) + 1
  }

  console.log("\nEvidence breakdown:")
  console.log("  With text artifact:", evidenceStats.hasArtifact)
  console.log("  With rawContent only:", evidenceStats.hasRawContent)
  console.log("  No content:", evidenceStats.hasNeither)
  console.log("\nBy contentClass:")
  for (const [cc, count] of Object.entries(evidenceStats.byContentClass)) {
    console.log(`  ${cc}: ${count}`)
  }

  // Sample some problem cases
  console.log("\n=== Sample Problem Cases ===\n")
  const samples = problemPointers.slice(0, 3)
  for (const p of samples) {
    console.log(`Pointer: ${p.id.slice(0, 8)}...`)
    console.log(`  matchType: ${p.matchType}`)
    console.log(`  Quote (50 chars): "${p.exactQuote.slice(0, 50)}..."`)

    const evidence = evidenceList.find((e) => e.id === p.evidenceId)
    if (evidence) {
      console.log(`  Evidence contentClass: ${evidence.contentClass}`)
      console.log(`  Evidence URL: ${evidence.url?.slice(0, 60)}...`)
      console.log(`  Has artifact: ${!!evidence.primaryTextArtifactId}`)
      console.log(`  Has rawContent: ${!!evidence.rawContent}`)
      if (evidence.rawContent) {
        console.log(`  rawContent length: ${evidence.rawContent.length}`)
      }
    }
    console.log("")
  }

  await db.$disconnect()
}

analyzeFailures().catch(console.error)
