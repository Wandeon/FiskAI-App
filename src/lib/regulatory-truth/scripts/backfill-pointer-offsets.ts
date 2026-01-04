// src/lib/regulatory-truth/scripts/backfill-pointer-offsets.ts
// Backfill script to populate startOffset, endOffset, and matchType for existing SourcePointers
//
// Usage:
//   npx tsx src/lib/regulatory-truth/scripts/backfill-pointer-offsets.ts [--dry-run] [--batch-size=100]
//
// This script:
// 1. Finds all SourcePointers with matchType = PENDING_VERIFICATION (or null)
// 2. For each, attempts to find exactQuote in Evidence.rawContent
// 3. Updates with offsets and matchType (EXACT, NORMALIZED, or NOT_FOUND)
// 4. Logs failures for manual review

import { db, dbReg } from "@/lib/db"
import { findQuoteInEvidence, type MatchType } from "../utils/quote-in-evidence"

interface BackfillResult {
  total: number
  updated: number
  exact: number
  normalized: number
  notFound: number
  errors: string[]
}

async function backfillPointerOffsets(options: {
  dryRun: boolean
  batchSize: number
}): Promise<BackfillResult> {
  const { dryRun, batchSize } = options

  console.log(`[backfill] Starting${dryRun ? " (DRY RUN)" : ""}...`)
  console.log(`[backfill] Batch size: ${batchSize}`)

  const result: BackfillResult = {
    total: 0,
    updated: 0,
    exact: 0,
    normalized: 0,
    notFound: 0,
    errors: [],
  }

  // Find all unverified pointers
  const totalCount = await db.sourcePointer.count({
    where: {
      OR: [{ matchType: null }, { matchType: "PENDING_VERIFICATION" }],
    },
  })

  console.log(`[backfill] Found ${totalCount} pointers to process`)
  result.total = totalCount

  let processed = 0
  let offset = 0

  while (offset < totalCount) {
    const pointers = await db.sourcePointer.findMany({
      where: {
        OR: [{ matchType: null }, { matchType: "PENDING_VERIFICATION" }],
      },
      take: batchSize,
      skip: offset,
    })

    if (pointers.length === 0) break

    // Fetch evidence records separately via dbReg (soft reference via evidenceId)
    const evidenceIds = pointers.map((p) => p.evidenceId)
    const evidenceRecords = await dbReg.evidence.findMany({
      where: { id: { in: evidenceIds } },
      select: {
        id: true,
        rawContent: true,
        contentHash: true,
      },
    })
    const evidenceMap = new Map(evidenceRecords.map((e) => [e.id, e]))

    for (const pointer of pointers) {
      processed++

      const evidence = evidenceMap.get(pointer.evidenceId)
      if (!evidence?.rawContent) {
        result.errors.push(`Pointer ${pointer.id}: No evidence rawContent found`)
        result.notFound++
        continue
      }

      // Find quote in evidence
      const matchResult = findQuoteInEvidence(
        evidence.rawContent,
        pointer.exactQuote,
        evidence.contentHash ?? undefined
      )

      if (!matchResult.found) {
        result.errors.push(
          `Pointer ${pointer.id}: Quote not found in evidence. ` +
            `Preview: "${pointer.exactQuote.slice(0, 50)}..."`
        )
        result.notFound++
        continue
      }

      // Map match type to enum
      const matchTypeEnum = matchTypeToEnum(matchResult.matchType)

      if (matchResult.matchType === "exact") {
        result.exact++
      } else {
        result.normalized++
      }

      if (!dryRun) {
        await db.sourcePointer.update({
          where: { id: pointer.id },
          data: {
            startOffset: matchResult.start,
            endOffset: matchResult.end,
            matchType: matchTypeEnum,
          },
        })
      }

      result.updated++

      if (processed % 100 === 0) {
        console.log(`[backfill] Processed ${processed}/${totalCount}...`)
      }
    }

    offset += batchSize
  }

  console.log(`\n[backfill] Complete:`)
  console.log(`  Total:      ${result.total}`)
  console.log(`  Updated:    ${result.updated}`)
  console.log(`  Exact:      ${result.exact}`)
  console.log(`  Normalized: ${result.normalized}`)
  console.log(`  Not found:  ${result.notFound}`)

  if (result.errors.length > 0) {
    console.log(`\n[backfill] Errors (${result.errors.length}):`)
    for (const error of result.errors.slice(0, 20)) {
      console.log(`  ${error}`)
    }
    if (result.errors.length > 20) {
      console.log(`  ... and ${result.errors.length - 20} more`)
    }
  }

  return result
}

function matchTypeToEnum(matchType: MatchType): "EXACT" | "NORMALIZED" | "NOT_FOUND" {
  switch (matchType) {
    case "exact":
      return "EXACT"
    case "normalized":
      return "NORMALIZED"
    case "not_found":
      return "NOT_FOUND"
  }
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const batchSizeArg = args.find((a) => a.startsWith("--batch-size="))
  const batchSize = batchSizeArg ? parseInt(batchSizeArg.split("=")[1]) : 100

  try {
    const result = await backfillPointerOffsets({ dryRun, batchSize })

    if (result.notFound > 0) {
      console.log(
        `\n[backfill] WARNING: ${result.notFound} pointers have quotes not found in evidence`
      )
      console.log(`          These require manual review or evidence refresh`)
    }

    process.exit(0)
  } catch (error) {
    console.error("[backfill] Fatal error:", error)
    process.exit(1)
  }
}

void main()

export { backfillPointerOffsets }
