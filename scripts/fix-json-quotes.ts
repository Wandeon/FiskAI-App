#!/usr/bin/env tsx
// scripts/fix-json-quotes.ts
// Fix exchange rate rules that have quotes not in evidence

import { db } from "../src/lib/db"
import { dbReg } from "../src/lib/db/regulatory"

/**
 * Check if content is JSON (starts with { or [)
 */
function isJsonContent(content: string): boolean {
  const trimmed = content.trim()
  return trimmed.startsWith("{") || trimmed.startsWith("[")
}

/**
 * Helper to find a value in a JSON object and return the key-value pair
 */
function findInJsonObject(obj: any, value: string): string | null {
  if (typeof obj !== "object" || obj === null) return null

  for (const [key, val] of Object.entries(obj)) {
    const valStr = String(val)

    // Normalize value for comparison (remove thousand separators)
    const normalizedValue = value.replace(/[.,\s]/g, "")
    const normalizedVal = valStr.replace(/[.,\s]/g, "")

    // Check if this field contains the exact value
    if (normalizedVal === normalizedValue || valStr === value) {
      // Return as JSON key-value pair
      return `"${key}": ${JSON.stringify(val)}`
    }

    // Recurse into nested objects
    if (typeof val === "object" && val !== null) {
      const found = findInJsonObject(val, value)
      if (found) return found
    }
  }
  return null
}

/**
 * Extract a verbatim quote from JSON content that contains the value.
 */
function extractQuoteFromJson(content: string, value: string): string | null {
  try {
    const json = JSON.parse(content)

    // For arrays, find the object and return a fragment
    if (Array.isArray(json)) {
      for (const item of json) {
        const found = findInJsonObject(item, value)
        if (found) return found
      }
    } else {
      const found = findInJsonObject(json, value)
      if (found) return found
    }

    return null
  } catch (error) {
    console.warn(`Failed to parse JSON for quote extraction: ${error}`)
    return null
  }
}

async function main() {
  console.log("Finding SourcePointers with JSON evidence that need fixing...")

  // Get all source pointers (in core db)
  const pointers = await db.sourcePointer.findMany()

  // Get all evidence (in regulatory db) and create lookup map
  const evidenceRecords = await dbReg.evidence.findMany()
  const evidenceMap = new Map(evidenceRecords.map((e) => [e.id, e]))

  let fixed = 0
  let skipped = 0
  let failed = 0

  for (const pointer of pointers) {
    const evidence = evidenceMap.get(pointer.evidenceId)

    if (!evidence) {
      console.warn(`Evidence ${pointer.evidenceId} not found for pointer ${pointer.id}`)
      failed++
      continue
    }

    // Check if evidence is JSON
    if (evidence.contentType !== "json" && !isJsonContent(evidence.rawContent)) {
      skipped++
      continue
    }

    // Try to extract a better quote
    const betterQuote = extractQuoteFromJson(evidence.rawContent, pointer.extractedValue)

    if (!betterQuote) {
      console.warn(
        `Could not extract quote for pointer ${pointer.id} with value ${pointer.extractedValue}`
      )
      failed++
      continue
    }

    // Check if quote needs updating
    if (pointer.exactQuote === betterQuote) {
      skipped++
      continue
    }

    console.log(`Fixing pointer ${pointer.id}:`)
    console.log(`  Old quote: ${pointer.exactQuote}`)
    console.log(`  New quote: ${betterQuote}`)

    // Update the pointer (in core db)
    await db.sourcePointer.update({
      where: { id: pointer.id },
      data: {
        exactQuote: betterQuote,
        extractionNotes:
          `${pointer.extractionNotes || ""} [MIGRATION: Quote corrected from JSON response]`.trim(),
      },
    })

    fixed++
  }

  console.log("\nMigration complete:")
  console.log(`  Fixed: ${fixed}`)
  console.log(`  Skipped: ${skipped}`)
  console.log(`  Failed: ${failed}`)
  console.log(`  Total: ${pointers.length}`)
}

main()
  .then(() => {
    console.log("Done!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Migration failed:", error)
    process.exit(1)
  })
