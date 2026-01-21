#!/usr/bin/env npx tsx
import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

async function main() {
  const { db } = await import("../src/lib/db")

  // Get sample CandidateFacts to check groundingQuotes
  const facts = await db.candidateFact.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      suggestedConceptSlug: true,
      groundingQuotes: true,
      extractorNotes: true,
    },
  })

  console.log("Sample groundingQuotes structure:")
  for (const f of facts) {
    const gq = f.groundingQuotes as Array<{ quote?: string; nodePath?: string }>
    const hasNodePath = gq?.some((q) => q.nodePath)
    console.log("  -", f.suggestedConceptSlug)
    console.log("    hasNodePath:", hasNodePath)
    if (gq && gq[0]) {
      console.log("    nodePath:", gq[0].nodePath || "(missing)")
      console.log("    quote snippet:", (gq[0].quote || "").slice(0, 50))
    }
  }

  // Count how many have nodePath
  const allFacts = await db.candidateFact.findMany({
    select: { groundingQuotes: true },
    take: 500,
  })

  let withNodePath = 0
  let withoutNodePath = 0
  for (const f of allFacts) {
    const gq = f.groundingQuotes as Array<{ nodePath?: string }>
    if (gq?.some((q) => q.nodePath)) {
      withNodePath++
    } else {
      withoutNodePath++
    }
  }

  console.log("\nNodePath statistics:")
  console.log("  With nodePath:", withNodePath)
  console.log("  Without nodePath:", withoutNodePath)

  await db.$disconnect()
}

main().catch(console.error)
