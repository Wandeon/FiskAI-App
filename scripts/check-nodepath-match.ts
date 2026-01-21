#!/usr/bin/env npx tsx
import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

async function main() {
  const { db, dbReg } = await import("../src/lib/db")
  const { parseProvisionTree, stripHtml } =
    await import("../src/lib/regulatory-truth/extraction/chunk-planner")

  // Get evidence from regulatory DB
  const evidenceId = "cmkivgiit001801rtfn33iza3"
  const evidence = await dbReg.evidence.findUnique({
    where: { id: evidenceId },
    select: { rawContent: true },
  })

  if (!evidence) {
    console.log("Evidence not found")
    return
  }

  // Parse tree to get expected node paths
  const cleanText = stripHtml(evidence.rawContent || "")
  const tree = parseProvisionTree(cleanText)

  const expectedPaths = new Set<string>()
  function collectPaths(node: { type: string; number: string; children: unknown[] }, prefix = "") {
    let path = prefix
    if (node.type === "article") {
      path = `/članak:${node.number}`
    } else if (node.type === "paragraph") {
      path = `${prefix}/stavak:${node.number}`
    } else if (node.type === "point") {
      path = `${prefix}/točka:${node.number}`
    }
    expectedPaths.add(path)
    for (const child of node.children || []) {
      collectPaths(child as typeof node, path)
    }
  }
  for (const article of tree) {
    collectPaths(article)
  }

  console.log("Expected node paths (sample):")
  Array.from(expectedPaths)
    .slice(0, 20)
    .forEach((p) => console.log("  " + p))
  console.log("  ... (" + expectedPaths.size + " total)")

  // Get facts with nodePath
  const facts = await db.candidateFact.findMany({
    select: { groundingQuotes: true },
    take: 500,
  })

  const factPaths = new Set<string>()
  for (const f of facts) {
    const gq = f.groundingQuotes as Array<{ nodePath?: string }>
    if (gq && gq[0]?.nodePath) {
      factPaths.add(gq[0].nodePath)
    }
  }

  console.log("\nFact node paths (sample):")
  Array.from(factPaths)
    .slice(0, 20)
    .forEach((p) => console.log("  " + p))
  console.log("  ... (" + factPaths.size + " total)")

  // Check matches
  let matched = 0
  let unmatched = 0
  const unmatchedSamples: string[] = []
  for (const path of factPaths) {
    if (expectedPaths.has(path)) {
      matched++
    } else {
      unmatched++
      if (unmatchedSamples.length < 10) {
        unmatchedSamples.push(path)
      }
    }
  }

  console.log("\nPath matching:")
  console.log("  Matched:", matched)
  console.log("  Unmatched:", unmatched)
  if (unmatchedSamples.length > 0) {
    console.log("\nUnmatched path samples:")
    unmatchedSamples.forEach((p) => console.log("  " + p))
  }

  await db.$disconnect()
  await dbReg.$disconnect()
}

main().catch(console.error)
