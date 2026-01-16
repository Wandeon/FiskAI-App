// scripts/analyze-evidence-gaps.ts
// Deep analysis of evidence content gaps

import "dotenv/config"
import { db, dbReg } from "../src/lib/db"
import { getExtractableContent } from "../src/lib/regulatory-truth/utils/content-provider"

async function analyzeEvidenceGaps() {
  console.log("=== Evidence Content Gap Analysis ===\n")

  // Get all evidence
  const allEvidence = await dbReg.evidence.findMany({
    select: {
      id: true,
      contentClass: true,
      url: true,
      primaryTextArtifactId: true,
      rawContent: true,
    },
  })

  console.log("Total evidence records:", allEvidence.length)

  // Categorize
  const stats = {
    total: allEvidence.length,
    withArtifact: 0,
    withRawContent: 0,
    withBoth: 0,
    withNeither: 0,
    byContentClass: {} as Record<string, { total: number; hasContent: number }>,
  }

  for (const e of allEvidence) {
    const hasArtifact = !!e.primaryTextArtifactId
    const hasRawContent = !!e.rawContent

    if (hasArtifact && hasRawContent) stats.withBoth++
    else if (hasArtifact) stats.withArtifact++
    else if (hasRawContent) stats.withRawContent++
    else stats.withNeither++

    // By contentClass
    if (!stats.byContentClass[e.contentClass]) {
      stats.byContentClass[e.contentClass] = { total: 0, hasContent: 0 }
    }
    stats.byContentClass[e.contentClass].total++
    if (hasArtifact || hasRawContent) {
      stats.byContentClass[e.contentClass].hasContent++
    }
  }

  console.log("\nContent availability:")
  console.log(`  With artifact only: ${stats.withArtifact}`)
  console.log(`  With rawContent only: ${stats.withRawContent}`)
  console.log(`  With both: ${stats.withBoth}`)
  console.log(`  With neither: ${stats.withNeither}`)

  console.log("\nBy contentClass:")
  for (const [cc, { total, hasContent }] of Object.entries(stats.byContentClass)) {
    const pct = ((hasContent / total) * 100).toFixed(0)
    console.log(`  ${cc}: ${hasContent}/${total} (${pct}% have content)`)
  }

  // Test content provider on a few problematic evidence
  console.log("\n=== Testing Content Provider ===\n")

  const noContentEvidence = allEvidence
    .filter((e) => !e.primaryTextArtifactId && !e.rawContent)
    .slice(0, 3)

  for (const e of noContentEvidence) {
    console.log(`Evidence ${e.id.slice(0, 8)}... (${e.contentClass})`)
    console.log(`  URL: ${e.url?.slice(0, 60)}...`)
    try {
      const content = await getExtractableContent(e.id)
      console.log(`  Content source: ${content.source}`)
      console.log(`  Content length: ${content.text.length}`)
    } catch (err) {
      console.log(`  ❌ Error: ${(err as Error).message}`)
    }
    console.log("")
  }

  // Check which evidence IDs are referenced by failing source pointers
  console.log("\n=== Evidence Referenced by Failing Pointers ===\n")

  const failingPointers = await db.sourcePointer.findMany({
    where: { matchType: "NOT_FOUND" },
    select: { evidenceId: true },
    distinct: ["evidenceId"],
  })

  const failingEvidenceIds = failingPointers.map((p) => p.evidenceId)
  console.log("Unique evidence IDs with NOT_FOUND pointers:", failingEvidenceIds.length)

  // Check content status for these
  const failingEvidence = allEvidence.filter((e) => failingEvidenceIds.includes(e.id))
  let failingWithContent = 0
  let failingWithoutContent = 0

  for (const e of failingEvidence) {
    if (e.primaryTextArtifactId || e.rawContent) {
      failingWithContent++
    } else {
      failingWithoutContent++
    }
  }

  console.log(`  Have content: ${failingWithContent}`)
  console.log(`  Missing content: ${failingWithoutContent}`)

  if (failingWithContent > 0) {
    console.log("\n=== Examining Evidence WITH Content but NOT_FOUND ===\n")
    const withContentButFailing = failingEvidence.filter(
      (e) => e.primaryTextArtifactId || e.rawContent
    )

    for (const e of withContentButFailing.slice(0, 2)) {
      console.log(`Evidence ${e.id.slice(0, 8)}... (${e.contentClass})`)
      try {
        const content = await getExtractableContent(e.id)
        console.log(`  Content length: ${content.text.length}`)
        console.log(`  Content preview: "${content.text.slice(0, 200)}..."`)

        // Get pointers for this evidence
        const pointers = await db.sourcePointer.findMany({
          where: { evidenceId: e.id, matchType: "NOT_FOUND" },
          select: { exactQuote: true },
          take: 2,
        })

        for (const p of pointers) {
          console.log(`\n  Pointer quote: "${p.exactQuote.slice(0, 100)}..."`)
          // Check if quote appears anywhere
          const lowerContent = content.text.toLowerCase()
          const lowerQuote = p.exactQuote.toLowerCase()
          const firstWords = lowerQuote.split(" ").slice(0, 3).join(" ")
          if (lowerContent.includes(firstWords)) {
            console.log(`  First 3 words found in content!`)
          } else {
            console.log(`  First 3 words NOT found: "${firstWords}"`)
          }
        }
      } catch (err) {
        console.log(`  ❌ Error: ${(err as Error).message}`)
      }
      console.log("")
    }
  }

  await db.$disconnect()
}

analyzeEvidenceGaps().catch(console.error)
