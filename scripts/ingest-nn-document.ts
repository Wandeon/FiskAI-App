#!/usr/bin/env npx tsx
/**
 * Ingest a Narodne Novine document into the Evidence table
 *
 * Usage: npx tsx scripts/ingest-nn-document.ts <url>
 */

import { config } from "dotenv"
import { createHash } from "crypto"
config({ path: ".env.local" })
config({ path: ".env" })

async function main() {
  const { dbReg } = await import("../src/lib/db")

  const url = process.argv[2]
  if (!url) {
    console.error("Usage: npx tsx scripts/ingest-nn-document.ts <url>")
    process.exit(1)
  }

  console.log("=== Ingesting NN Document ===")
  console.log("URL:", url)

  // 1. Find or create NN source
  let source = await dbReg.regulatorySource.findFirst({
    where: {
      OR: [{ slug: "narodne-novine" }, { slug: "nn" }, { url: { contains: "narodne-novine" } }],
    },
  })

  if (!source) {
    console.log("Creating NN source...")
    source = await dbReg.regulatorySource.create({
      data: {
        name: "Narodne Novine",
        slug: "narodne-novine",
        url: "https://narodne-novine.nn.hr",
        isActive: true,
      },
    })
  }
  console.log("Source ID:", source.id)

  // 2. Check if already exists
  const existing = await dbReg.evidence.findFirst({
    where: { url },
  })

  if (existing) {
    console.log("Document already exists!")
    console.log("Evidence ID:", existing.id)
    await dbReg.$disconnect()
    return
  }

  // 3. Fetch HTML
  console.log("Fetching document...")
  const response = await fetch(url, {
    headers: {
      "User-Agent": "FiskAI-RTL/1.0 (regulatory compliance research)",
    },
  })

  if (!response.ok) {
    console.error("Failed to fetch:", response.status, response.statusText)
    process.exit(1)
  }

  const rawContent = await response.text()
  console.log("Content length:", rawContent.length, "chars")

  // 4. Create content hash
  const contentHash = createHash("sha256").update(rawContent).digest("hex")

  // 5. Create Evidence record
  const evidence = await dbReg.evidence.create({
    data: {
      sourceId: source.id,
      url,
      rawContent,
      contentHash,
      contentType: "html",
      contentClass: "HTML",
      stalenessStatus: "FRESH",
      hasChanged: false,
    },
  })

  console.log()
  console.log("=== Document Ingested ===")
  console.log("Evidence ID:", evidence.id)
  console.log("Content hash:", contentHash.slice(0, 16) + "...")
  console.log()
  console.log("Next steps:")
  console.log(`  npx tsx scripts/run-chunked-extraction.ts ${evidence.id}`)
  console.log(`  npx tsx scripts/generate-coverage-review.ts ${evidence.id}`)

  await dbReg.$disconnect()
}

main().catch((error) => {
  console.error("Error:", error)
  process.exit(1)
})
