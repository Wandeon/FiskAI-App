#!/usr/bin/env npx tsx
// scripts/test-single-extraction.ts
// Test a single extraction with the new API key

import { config } from "dotenv"
config() // Load .env file

import { db } from "../src/lib/db"
import { dbReg } from "../src/lib/db/regulatory"
import { runExtractor } from "../src/lib/regulatory-truth/agents"

async function test() {
  // Get an evidence record that hasn't been processed (cross-schema query)
  const evidenceWithPointers = new Set(
    (await db.sourcePointer.findMany({ select: { evidenceId: true } })).map((p) => p.evidenceId)
  )
  const allEvidence = await dbReg.evidence.findMany({ include: { source: true }, take: 100 })
  const unprocessedEvidence = allEvidence.filter((e) => !evidenceWithPointers.has(e.id))
  const evidence = unprocessedEvidence[0]

  if (!evidence) {
    // Get any evidence for testing
    const anyEvidence = await dbReg.evidence.findFirst({ include: { source: true } })
    if (!anyEvidence) {
      console.log("No evidence records found")
      return
    }
    console.log("All evidence already processed. Testing with:", anyEvidence.source?.name)
    console.log("URL:", anyEvidence.url)

    console.log("\nRunning extraction...")
    const startTime = Date.now()
    const result = await runExtractor(anyEvidence.id)
    const duration = Date.now() - startTime

    console.log("\n=== RESULT ===")
    console.log("Success:", result.success)
    console.log("Duration:", duration, "ms")
    console.log("Source Pointers Created:", result.sourcePointerIds.length)

    if (result.error) {
      console.log("Error:", result.error)
    }

    if (result.output) {
      console.log("\nExtractions:")
      for (const ext of result.output.extractions) {
        console.log("  -", ext.domain, ":", ext.extracted_value)
        if (ext.exact_quote) {
          console.log("    Quote:", ext.exact_quote.slice(0, 80) + "...")
        }
      }
    }
    return
  }

  console.log("Testing extraction for:", evidence.source?.name)
  console.log("URL:", evidence.url)
  console.log("Content length:", evidence.rawContent?.length || 0, "chars")
  console.log("\nRunning extraction...")

  const startTime = Date.now()
  const result = await runExtractor(evidence.id)
  const duration = Date.now() - startTime

  console.log("\n=== RESULT ===")
  console.log("Success:", result.success)
  console.log("Duration:", duration, "ms")
  console.log("Source Pointers Created:", result.sourcePointerIds.length)

  if (result.error) {
    console.log("Error:", result.error)
  }

  if (result.output) {
    console.log("\nExtractions:")
    for (const ext of result.output.extractions) {
      console.log("  -", ext.domain, ":", ext.extracted_value)
      if (ext.exact_quote) {
        console.log("    Quote:", ext.exact_quote.slice(0, 80) + "...")
      }
    }
  }
}

test()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
