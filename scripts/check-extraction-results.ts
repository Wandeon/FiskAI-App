#!/usr/bin/env npx tsx
import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

async function main() {
  const { db } = await import("../src/lib/db")

  const evidenceId = process.argv[2] || "cmkivgiit001801rtfn33iza3"

  // Get recent extraction runs
  const runs = await db.agentRun.findMany({
    where: {
      agentType: "EXTRACTOR",
      evidenceId,
    },
    select: {
      id: true,
      status: true,
      outcome: true,
      itemsProduced: true,
      tokensUsed: true,
      durationMs: true,
      startedAt: true,
      output: true,
    },
    orderBy: { startedAt: "desc" },
    take: 5,
  })

  console.log("=== Extraction Runs for", evidenceId, "===\n")
  for (const run of runs) {
    console.log(`Run ${run.id}`)
    console.log(`  Status: ${run.status} / Outcome: ${run.outcome}`)
    console.log(
      `  Items: ${run.itemsProduced}, Tokens: ${run.tokensUsed}, Duration: ${((run.durationMs || 0) / 1000).toFixed(1)}s`
    )
    console.log(`  Started: ${run.startedAt.toISOString()}`)

    // Parse output for summary
    if (run.output && typeof run.output === "object") {
      const output = run.output as {
        summary?: {
          totalChunks?: number
          completedChunks?: number
          totalAssertions?: number
          coveragePercent?: number
          assertionsByType?: Record<string, number>
        }
      }
      if (output.summary) {
        const s = output.summary
        console.log(`  Chunks: ${s.completedChunks}/${s.totalChunks}`)
        console.log(`  Assertions: ${s.totalAssertions}`)
        console.log(`  Coverage: ${s.coveragePercent}%`)
        if (s.assertionsByType) {
          console.log(`  By type: ${JSON.stringify(s.assertionsByType)}`)
        }
      }
    }
    console.log()
  }

  // Count CandidateFacts
  const factCount = await db.candidateFact.count()
  console.log(`Total CandidateFacts in DB: ${factCount}`)

  // Get recent facts
  const recentFacts = await db.candidateFact.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      suggestedConceptSlug: true,
      extractedValue: true,
      suggestedValueType: true,
      overallConfidence: true,
      createdAt: true,
    },
  })

  console.log("\nRecent CandidateFacts:")
  for (const f of recentFacts) {
    const value = (f.extractedValue || "").slice(0, 40)
    console.log(
      `  ${f.suggestedConceptSlug}: "${value}..." (${f.suggestedValueType}, conf: ${f.overallConfidence})`
    )
  }

  await db.$disconnect()
}

main().catch(console.error)
