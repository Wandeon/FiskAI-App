// src/lib/regulatory-truth/scripts/migrate-applieswhen-dsl.ts
// Migrate old function-style appliesWhen DSL to new JSON format

import { config } from "dotenv"
import { resolve } from "path"

const envPath = resolve(process.cwd(), ".env.local")
config({ path: envPath })

import { db } from "@/lib/db"

/**
 * Convert old function-style DSL to new JSON predicate format
 *
 * Old format: date_range("2024-01-01", null)
 * New format: { "op": "cmp", "field": "context.asOf", "cmp": "gte", "value": "2024-01-01" }
 */
function convertDateRange(dslString: string): object {
  // Match date_range("start", "end"|null)
  const dateRangeMatch = dslString.match(/date_range\("([^"]+)",\s*(?:"([^"]+)"|null)\)/)

  if (dateRangeMatch) {
    const [, startDate, endDate] = dateRangeMatch

    if (endDate) {
      // Both start and end - use between
      return {
        op: "between",
        field: "context.asOf",
        gte: startDate,
        lte: endDate,
      }
    } else {
      // Only start date - use gte
      return {
        op: "cmp",
        field: "context.asOf",
        cmp: "gte",
        value: startDate,
      }
    }
  }

  return { op: "true" }
}

function convertOr(dslString: string): object {
  // Match OR(date_range(...), date_range(...), ...)
  const orMatch = dslString.match(/^OR\((.+)\)$/)

  if (orMatch) {
    const innerContent = orMatch[1]
    // Split by date_range and process each
    const dateRanges = innerContent.match(/date_range\([^)]+\)/g) || []
    const args = dateRanges.map((dr) => convertDateRange(dr))

    return {
      op: "or",
      args,
    }
  }

  return { op: "true" }
}

function convertDsl(dslString: string): string {
  if (!dslString) {
    return JSON.stringify({ op: "true" })
  }

  // Check if already JSON
  try {
    const parsed = JSON.parse(dslString)
    if (parsed.op) {
      console.log("  Already in JSON format, skipping")
      return dslString
    }
  } catch {
    // Not JSON, continue with conversion
  }

  let result: object

  if (dslString.startsWith("OR(")) {
    result = convertOr(dslString)
  } else if (dslString.startsWith("date_range(")) {
    result = convertDateRange(dslString)
  } else {
    // Unknown format, default to always true
    console.log(`  Unknown format: ${dslString}, defaulting to { op: "true" }`)
    result = { op: "true" }
  }

  return JSON.stringify(result)
}

async function migrateAppliesWhenDsl() {
  console.log("[migrate] Starting appliesWhen DSL migration...")

  const rules = await db.regulatoryRule.findMany({
    select: {
      id: true,
      conceptSlug: true,
      appliesWhen: true,
      status: true,
    },
  })

  console.log(`[migrate] Found ${rules.length} rules to check`)

  let migrated = 0
  let skipped = 0

  for (const rule of rules) {
    console.log(`\n[migrate] Processing ${rule.conceptSlug} (${rule.status})`)
    console.log(`  Old: ${rule.appliesWhen}`)

    const newDsl = convertDsl(rule.appliesWhen || "")

    if (newDsl === rule.appliesWhen) {
      console.log("  Skipped (no change)")
      skipped++
      continue
    }

    console.log(`  New: ${newDsl}`)

    await db.regulatoryRule.update({
      where: { id: rule.id },
      data: { appliesWhen: newDsl },
    })

    console.log("  ✓ Updated")
    migrated++
  }

  console.log(`\n[migrate] Complete: ${migrated} rules migrated, ${skipped} skipped`)
}

migrateAppliesWhenDsl()
  .catch(console.error)
  .finally(() => process.exit(0))
