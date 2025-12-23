// scripts/fix-applies-when.ts
import { db } from "@/lib/db"
import { validateAppliesWhen } from "@/lib/regulatory-truth/dsl/applies-when"

interface FixResult {
  ruleId: string
  conceptSlug: string
  oldDsl: unknown
  newDsl: unknown
  fixType: "wrapped_in_and" | "replaced_with_true" | "converted_shorthand"
}

/**
 * Attempt to fix common invalid AppliesWhen DSL patterns
 */
function attemptFix(dsl: unknown): { fixed: unknown; fixType: string } | null {
  if (typeof dsl !== "object" || dsl === null) {
    return { fixed: { op: "true" }, fixType: "replaced_with_true" }
  }

  const obj = dsl as Record<string, unknown>

  // Pattern 1: Shorthand format like {"and": [...], "eq": [...]}
  // Convert to proper format: {"op": "and", "args": [...]}
  if ("and" in obj && Array.isArray(obj.and)) {
    const args = obj.and as unknown[]
    const fixedArgs = args.map((arg) => {
      if (typeof arg === "object" && arg !== null) {
        const argObj = arg as Record<string, unknown>

        // Convert {"eq": ["field", "value"]} to {"op": "cmp", "field": "field", "cmp": "eq", "value": "value"}
        if ("eq" in argObj && Array.isArray(argObj.eq)) {
          const [field, value] = argObj.eq as [string, unknown]
          return { op: "cmp", field, cmp: "eq", value }
        }

        // Convert {"date_in_range": ["field", "start", "end"]} to proper format
        if ("date_in_range" in argObj && Array.isArray(argObj.date_in_range)) {
          const [field, start, end] = argObj.date_in_range as [string, string, string]
          if (start === end) {
            // Single date check
            return { op: "cmp", field, cmp: "eq", value: start }
          } else {
            // Date range
            return {
              op: "and",
              args: [
                { op: "cmp", field, cmp: "gte", value: start },
                { op: "cmp", field, cmp: "lte", value: end },
              ],
            }
          }
        }

        // Recursively fix nested objects
        const fixed = attemptFix(argObj)
        return fixed ? fixed.fixed : argObj
      }
      return arg
    })

    return {
      fixed: { op: "and", args: fixedArgs },
      fixType: "converted_shorthand",
    }
  }

  // Pattern 2: Missing "op" field but has other valid structure
  if (!("op" in obj)) {
    // If it looks like a condition but missing "op", wrap in true
    return { fixed: { op: "true" }, fixType: "replaced_with_true" }
  }

  // Pattern 3: Already valid structure, but might have nested invalid parts
  if (obj.op === "and" && "args" in obj && Array.isArray(obj.args)) {
    const args = obj.args as unknown[]
    const fixedArgs = args.map((arg) => {
      const fixed = attemptFix(arg)
      return fixed ? fixed.fixed : arg
    })
    return {
      fixed: { op: "and", args: fixedArgs },
      fixType: "wrapped_in_and",
    }
  }

  if (obj.op === "or" && "args" in obj && Array.isArray(obj.args)) {
    const args = obj.args as unknown[]
    const fixedArgs = args.map((arg) => {
      const fixed = attemptFix(arg)
      return fixed ? fixed.fixed : arg
    })
    return {
      fixed: { op: "or", args: fixedArgs },
      fixType: "wrapped_in_and",
    }
  }

  return null
}

async function main() {
  const dryRun = process.argv.includes("--dry-run")
  const verbose = process.argv.includes("--verbose")

  console.log("=".repeat(80))
  console.log(`AppliesWhen DSL Validation and Fix Script`)
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`)
  console.log("=".repeat(80))
  console.log("")

  // Fetch all rules (we'll filter later)
  const allRules = await db.regulatoryRule.findMany({
    select: {
      id: true,
      conceptSlug: true,
      appliesWhen: true,
      composerNotes: true,
    },
  })

  // Filter to only rules with appliesWhen
  const rules = allRules.filter((r) => r.appliesWhen !== null && r.appliesWhen !== "")

  console.log(`Found ${rules.length} rules with appliesWhen DSL\n`)

  const invalidRules: Array<{
    id: string
    conceptSlug: string
    appliesWhen: unknown
    error: string
  }> = []
  const fixes: FixResult[] = []

  // Validate each rule
  for (const rule of rules) {
    try {
      const parsed =
        typeof rule.appliesWhen === "string"
          ? JSON.parse(rule.appliesWhen as string)
          : rule.appliesWhen

      const validation = validateAppliesWhen(parsed)

      if (!validation.valid) {
        invalidRules.push({
          id: rule.id,
          conceptSlug: rule.conceptSlug,
          appliesWhen: parsed,
          error: validation.error || "Unknown validation error",
        })

        if (verbose) {
          console.log(`❌ ${rule.conceptSlug}`)
          console.log(`   Error: ${validation.error}`)
          console.log(`   DSL: ${JSON.stringify(parsed).substring(0, 100)}...`)
          console.log("")
        }
      }
    } catch (error) {
      invalidRules.push({
        id: rule.id,
        conceptSlug: rule.conceptSlug,
        appliesWhen: rule.appliesWhen,
        error: error instanceof Error ? error.message : "Parse error",
      })

      if (verbose) {
        console.log(`❌ ${rule.conceptSlug} (parse error)`)
        console.log(`   Error: ${error instanceof Error ? error.message : "Unknown error"}`)
        console.log("")
      }
    }
  }

  console.log(`Validation complete:`)
  console.log(`  ✅ Valid: ${rules.length - invalidRules.length}`)
  console.log(`  ❌ Invalid: ${invalidRules.length}`)
  console.log("")

  if (invalidRules.length === 0) {
    console.log("No invalid rules found. Exiting.")
    return
  }

  // Attempt to fix invalid rules
  console.log(`Attempting to fix ${invalidRules.length} invalid rules...\n`)

  for (const invalid of invalidRules) {
    const parsed =
      typeof invalid.appliesWhen === "string"
        ? JSON.parse(invalid.appliesWhen as string)
        : invalid.appliesWhen

    const fixResult = attemptFix(parsed)

    if (fixResult) {
      // Verify the fix is valid
      const validation = validateAppliesWhen(fixResult.fixed)

      if (validation.valid) {
        fixes.push({
          ruleId: invalid.id,
          conceptSlug: invalid.conceptSlug,
          oldDsl: parsed,
          newDsl: fixResult.fixed,
          fixType: fixResult.fixType as any,
        })

        if (verbose) {
          console.log(`✅ Fixed: ${invalid.conceptSlug}`)
          console.log(`   Fix type: ${fixResult.fixType}`)
          console.log(`   Old: ${JSON.stringify(parsed).substring(0, 80)}...`)
          console.log(`   New: ${JSON.stringify(fixResult.fixed).substring(0, 80)}...`)
          console.log("")
        }
      } else {
        console.log(`⚠️  Could not fix: ${invalid.conceptSlug}`)
        console.log(`   Attempted fix still invalid: ${validation.error}`)
        console.log(`   Will replace with { op: "true" }`)
        console.log("")

        fixes.push({
          ruleId: invalid.id,
          conceptSlug: invalid.conceptSlug,
          oldDsl: parsed,
          newDsl: { op: "true" },
          fixType: "replaced_with_true",
        })
      }
    } else {
      console.log(`⚠️  No fix available: ${invalid.conceptSlug}`)
      console.log(`   Will replace with { op: "true" }`)
      console.log("")

      fixes.push({
        ruleId: invalid.id,
        conceptSlug: invalid.conceptSlug,
        oldDsl: parsed,
        newDsl: { op: "true" },
        fixType: "replaced_with_true",
      })
    }
  }

  // Apply fixes
  console.log("")
  console.log(`Fix Summary:`)
  console.log(`  Total fixes: ${fixes.length}`)
  console.log(
    `  Converted shorthand: ${fixes.filter((f) => f.fixType === "converted_shorthand").length}`
  )
  console.log(
    `  Replaced with true: ${fixes.filter((f) => f.fixType === "replaced_with_true").length}`
  )
  console.log(`  Wrapped in AND: ${fixes.filter((f) => f.fixType === "wrapped_in_and").length}`)
  console.log("")

  if (!dryRun) {
    console.log("Applying fixes to database...")

    for (const fix of fixes) {
      const rule = rules.find((r) => r.id === fix.ruleId)
      if (!rule) continue

      await db.regulatoryRule.update({
        where: { id: fix.ruleId },
        data: {
          appliesWhen: JSON.stringify(fix.newDsl),
          composerNotes: `${rule.composerNotes || ""}\n[AUTO-FIX ${new Date().toISOString()}] Fixed invalid appliesWhen DSL (${fix.fixType})`,
        },
      })

      console.log(`  ✓ Fixed ${fix.conceptSlug}`)
    }

    console.log("")
    console.log(`✅ Applied ${fixes.length} fixes to database`)
  } else {
    console.log("DRY RUN: No changes made to database")
    console.log("Run without --dry-run to apply fixes")
  }

  // Show detailed report
  if (verbose && fixes.length > 0) {
    console.log("")
    console.log("=".repeat(80))
    console.log("Detailed Fix Report")
    console.log("=".repeat(80))

    for (const fix of fixes) {
      console.log("")
      console.log(`Concept: ${fix.conceptSlug}`)
      console.log(`Fix Type: ${fix.fixType}`)
      console.log(`Old DSL:`)
      console.log(JSON.stringify(fix.oldDsl, null, 2))
      console.log(`New DSL:`)
      console.log(JSON.stringify(fix.newDsl, null, 2))
      console.log("-".repeat(80))
    }
  }
}

main()
  .then(() => {
    console.log("\nScript completed successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.error("\nScript failed:", error)
    process.exit(1)
  })
