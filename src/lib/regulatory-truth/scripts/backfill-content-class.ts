#!/usr/bin/env npx tsx
// src/lib/regulatory-truth/scripts/backfill-content-class.ts
// One-time migration script to fix mislabeled content classification
//
// Usage:
//   npx tsx src/lib/regulatory-truth/scripts/backfill-content-class.ts --dry-run
//   npx tsx src/lib/regulatory-truth/scripts/backfill-content-class.ts --apply

import { db } from "@/lib/db"

const CONTENT_TYPE_TO_CLASS: Record<string, string> = {
  html: "HTML",
  pdf: "PDF_TEXT",
  doc: "DOC",
  docx: "DOCX",
  xls: "XLS",
  xlsx: "XLSX",
  json: "JSON",
  "json-ld": "JSON_LD",
  xml: "XML",
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = !args.includes("--apply")

  console.log("=".repeat(60))
  console.log(`CONTENT CLASS BACKFILL - ${dryRun ? "DRY RUN" : "APPLYING"}`)
  console.log("=".repeat(60))
  console.log()

  // Find mislabeled evidence records
  const mislabeled = await db.evidence.findMany({
    where: {
      contentClass: "HTML", // Default value that was wrongly applied
      contentType: { notIn: ["html", "HTML"] }, // But contentType is not HTML
    },
    select: {
      id: true,
      url: true,
      contentType: true,
      contentClass: true,
      ocrMetadata: true, // Use ocrMetadata as the JSON field
    },
  })

  console.log(`Found ${mislabeled.length} mislabeled evidence records:\n`)

  // Group by contentType for summary
  const byType = new Map<string, number>()
  for (const e of mislabeled) {
    const count = byType.get(e.contentType) || 0
    byType.set(e.contentType, count + 1)
  }

  console.log("By content type:")
  for (const [type, count] of byType) {
    const correctClass = CONTENT_TYPE_TO_CLASS[type] || "UNKNOWN"
    console.log(`  ${type}: ${count} records -> should be ${correctClass}`)
  }
  console.log()

  if (mislabeled.length === 0) {
    console.log("No mislabeled records found. Nothing to fix.")
    process.exit(0)
  }

  if (dryRun) {
    console.log("\n[DRY RUN] Would fix the following records:")
    for (const e of mislabeled.slice(0, 10)) {
      const correctClass = CONTENT_TYPE_TO_CLASS[e.contentType] || "UNKNOWN"
      console.log(`  ${e.id.slice(0, 12)}... ${e.contentType} -> ${correctClass}`)
    }
    if (mislabeled.length > 10) {
      console.log(`  ... and ${mislabeled.length - 10} more`)
    }
    console.log("\nRun with --apply to fix these records.")
    process.exit(0)
  }

  // Apply fixes
  let fixed = 0
  let errors = 0

  for (const e of mislabeled) {
    const correctClass = CONTENT_TYPE_TO_CLASS[e.contentType]
    if (!correctClass) {
      console.log(`  SKIP: ${e.id} - unknown contentType: ${e.contentType}`)
      continue
    }

    try {
      // Preserve existing ocrMetadata and add fix timestamp
      const existingMetadata = (e.ocrMetadata as Record<string, unknown>) || {}

      await db.evidence.update({
        where: { id: e.id },
        data: {
          contentClass: correctClass,
          ocrMetadata: {
            ...existingMetadata,
            classificationFixedAt: new Date().toISOString(),
            previousContentClass: "HTML",
          },
        },
      })
      fixed++
    } catch (error) {
      console.error(`  ERROR: ${e.id} - ${error instanceof Error ? error.message : error}`)
      errors++
    }
  }

  console.log("\n" + "=".repeat(60))
  console.log("RESULTS")
  console.log("=".repeat(60))
  console.log(`Fixed: ${fixed}`)
  console.log(`Errors: ${errors}`)
  console.log(`Skipped: ${mislabeled.length - fixed - errors}`)

  // Verify fix
  const remaining = await db.evidence.count({
    where: {
      contentClass: "HTML",
      contentType: { notIn: ["html", "HTML"] },
    },
  })

  console.log(`\nRemaining mislabeled: ${remaining}`)

  process.exit(errors > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
