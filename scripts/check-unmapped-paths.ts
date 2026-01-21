#!/usr/bin/env npx tsx
import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

async function main() {
  const { db, dbReg } = await import("../src/lib/db")
  const { parseProvisionTree, stripHtml } =
    await import("../src/lib/regulatory-truth/extraction/chunk-planner")

  const evidenceId = "cmkivgiit001801rtfn33iza3"
  const evidence = await dbReg.evidence.findUnique({
    where: { id: evidenceId },
    select: { rawContent: true },
  })

  if (!evidence) {
    console.log("Evidence not found")
    return
  }

  const cleanText = stripHtml(evidence.rawContent || "")
  const tree = parseProvisionTree(cleanText)

  // Build expected paths
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

  // Get facts and check which paths don't match
  const facts = await db.candidateFact.findMany({
    select: { groundingQuotes: true, suggestedConceptSlug: true },
    take: 500,
  })

  // Find best matching path function
  function findBestMatchingPath(factPath: string): string | null {
    if (expectedPaths.has(factPath)) return factPath

    const segments = factPath.split("/").filter(Boolean)
    for (let len = segments.length - 1; len >= 1; len--) {
      const shorterPath = "/" + segments.slice(0, len).join("/")
      if (expectedPaths.has(shorterPath)) return shorterPath
    }

    const articleMatch = factPath.match(/\/članak:(\d+)/)
    if (articleMatch) {
      const simplePath = `/članak:${articleMatch[1]}`
      if (expectedPaths.has(simplePath)) return simplePath
    }

    return null
  }

  const unmatchedPaths = new Map<string, number>()
  for (const f of facts) {
    const gq = f.groundingQuotes as Array<{ nodePath?: string }>
    if (gq && gq[0]?.nodePath) {
      const path = gq[0].nodePath
      const match = findBestMatchingPath(path)
      if (!match) {
        unmatchedPaths.set(path, (unmatchedPaths.get(path) || 0) + 1)
      }
    }
  }

  console.log("Unmatched paths with counts:")
  const sorted = [...unmatchedPaths.entries()].sort((a, b) => b[1] - a[1])
  for (const [path, count] of sorted) {
    console.log(`  ${count}x ${path}`)
  }
  console.log(`\nTotal unique unmatched: ${unmatchedPaths.size}`)
  console.log(`Total unmatched facts: ${sorted.reduce((sum, [, c]) => sum + c, 0)}`)

  await db.$disconnect()
  await dbReg.$disconnect()
}

main().catch(console.error)
