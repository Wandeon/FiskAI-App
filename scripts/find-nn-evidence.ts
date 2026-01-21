#!/usr/bin/env npx tsx
/**
 * Find Narodne Novine evidence documents for coverage report testing
 */

import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

async function main() {
  const { dbReg } = await import("../src/lib/db")

  // Find NN sources
  const sources = await dbReg.regulatorySource.findMany({
    where: {
      OR: [
        { name: { contains: "Narodne" } },
        { slug: { contains: "narodne" } },
        { url: { contains: "narodne-novine" } },
        { slug: { contains: "nn" } },
      ],
    },
    select: { id: true, name: true, slug: true, url: true },
  })

  console.log("=== NN Sources ===")
  for (const s of sources) {
    console.log(`ID: ${s.id} Name: ${s.name} Slug: ${s.slug}`)
  }

  // Find all evidence from NN sources OR with NN URLs
  const evidence = await dbReg.evidence.findMany({
    where: {
      OR: [
        { sourceId: { in: sources.map((s) => s.id) } },
        { url: { contains: "narodne-novine" } },
        { url: { contains: "nn.hr" } },
      ],
    },
    select: {
      id: true,
      url: true,
      rawContent: true,
      fetchedAt: true,
      source: { select: { name: true, slug: true } },
    },
    orderBy: { fetchedAt: "desc" },
    take: 30,
  })

  console.log("\n=== NN Evidence ===")
  for (const e of evidence) {
    const len = e.rawContent?.length || 0
    console.log("---")
    console.log(`ID: ${e.id}`)
    console.log(`Source: ${e.source?.name || e.source?.slug}`)
    console.log(`URL: ${e.url}`)
    console.log(`Content: ${len} chars`)
  }

  await dbReg.$disconnect()
}

main().catch(console.error)
