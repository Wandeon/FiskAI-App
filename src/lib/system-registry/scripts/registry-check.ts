#!/usr/bin/env npx tsx
/**
 * Registry Check Script
 *
 * Runs harvesters, computes drift, and enforces rules.
 * This is the CI entry point.
 *
 * Usage:
 *   npx tsx src/lib/system-registry/scripts/registry-check.ts
 *
 * Options:
 *   --json         Output JSON instead of markdown
 *   --fail-on-warn Treat warnings as failures
 *   --write-report Write drift-report.md to docs/system-registry/
 */

import { writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { harvestAll } from "../harvesters"
import { computeDrift, enforceRules, formatDriftMarkdown, HARVESTED_TYPES } from "../compute-drift"
import { ALL_COMPONENTS as DECLARED_COMPONENTS } from "../declarations"
import { shouldFailRegistryCheck } from "./registry-check-utils"

interface Options {
  json: boolean
  failOnWarn: boolean
  writeReport: boolean
  projectRoot: string
}

function parseArgs(): Options {
  const args = process.argv.slice(2)
  return {
    json: args.includes("--json"),
    failOnWarn: args.includes("--fail-on-warn"),
    writeReport: args.includes("--write-report"),
    projectRoot: args.find((a) => !a.startsWith("--")) || process.cwd(),
  }
}

async function main() {
  const options = parseArgs()
  const startTime = Date.now()

  console.error("🔍 Running System Registry Check...")
  console.error("")

  // Step 1: Harvest all components
  console.error("📥 Harvesting observed components...")
  console.error(`   All types harvested: ${HARVESTED_TYPES.join(", ")}`)
  console.error("")

  const harvestResult = await harvestAll(options.projectRoot)

  console.error(`   Found ${harvestResult.components.length} components (harvested types only)`)
  for (const r of harvestResult.metadata.harvesterResults) {
    console.error(`   - ${r.name}: ${r.componentCount} (${r.durationMs}ms)`)
  }
  if (harvestResult.errors.length > 0) {
    console.error("")
    console.error("   Harvester errors:")
    for (const err of harvestResult.errors) {
      console.error(`   - ${err.path}: ${err.message}`)
    }
  }
  console.error("")

  // Step 2: Compute drift (with codeRef verification for all declared components)
  console.error("📊 Computing drift (+ codeRef verification for all declared)...")
  const driftResult = computeDrift(
    harvestResult.components,
    DECLARED_COMPONENTS,
    options.projectRoot
  )

  console.error("")
  console.error("   Type Coverage Matrix:")
  console.error("   ┌──────────────┬──────────┬──────────┬────────────┬─────────────┐")
  console.error("   │ Type         │ Declared │ Observed │ CodeRef OK │ CodeRef Bad │")
  console.error("   ├──────────────┼──────────┼──────────┼────────────┼─────────────┤")
  for (const tc of driftResult.typeCoverage) {
    console.error(
      `   │ ${tc.type.padEnd(12)} │ ${String(tc.declared).padStart(8)} │ ${String(tc.observed).padStart(8)} │ ${String(tc.codeRefVerified).padStart(10)} │ ${String(tc.codeRefMissing).padStart(11)} │`
    )
  }
  console.error("   └──────────────┴──────────┴──────────┴────────────┴─────────────┘")
  console.error("")

  console.error("   Summary:")
  console.error(`   - Observed (Total):         ${driftResult.summary.observedTotal}`)
  console.error(`   - Declared (Total):         ${driftResult.summary.declaredTotal}`)
  console.error(`   - Observed Not Declared:    ${driftResult.summary.observedNotDeclaredCount}`)
  console.error(`   - Declared Not Observed:    ${driftResult.summary.declaredNotObservedCount}`)
  console.error(`   - CodeRef Invalid:          ${driftResult.summary.codeRefInvalidCount}`)
  console.error(`   - Metadata Gaps:            ${driftResult.summary.metadataGapCount}`)
  console.error(`   - Unknown Integrations:     ${driftResult.summary.unknownIntegrationCount}`)
  console.error(`   - Critical Issues:          ${driftResult.summary.criticalIssues}`)
  console.error(`   - High Issues:              ${driftResult.summary.highIssues}`)
  if (driftResult.governanceViolations.length > 0) {
    console.error(`   - Governance Violations:    ${driftResult.governanceViolations.length} ⚠️`)
  }
  if (driftResult.deprecatedOwners.length > 0) {
    console.error(`   - Deprecated Owners:        ${driftResult.deprecatedOwners.length}`)
  }
  console.error("")

  // Step 3: Enforce rules
  console.error("⚖️  Enforcing rules...")
  const enforcementResult = enforceRules(driftResult)

  console.error(`   Failures: ${enforcementResult.failures.length}`)
  console.error(`   Warnings: ${enforcementResult.warnings.length}`)
  console.error("")

  // Step 4: Output results
  if (options.writeReport) {
    const reportPath = join(options.projectRoot, "docs/system-registry/drift-report-ci.md")
    mkdirSync(dirname(reportPath), { recursive: true })
    const markdown = formatDriftMarkdown(driftResult, enforcementResult)
    writeFileSync(reportPath, markdown)
    console.error(`📝 Report written to: ${reportPath}`)
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          schemaVersion: "1.0.0",
          harvest: harvestResult,
          drift: driftResult,
          enforcement: enforcementResult,
          metadata: {
            executedAt: new Date().toISOString(),
            durationMs: Date.now() - startTime,
            harvestedTypes: HARVESTED_TYPES,
          },
        },
        null,
        2
      )
    )
  } else {
    console.log(formatDriftMarkdown(driftResult, enforcementResult))
  }

  // Step 5: Exit with appropriate code
  const failed = shouldFailRegistryCheck({
    harvesterErrors: harvestResult.errors,
    enforcement: enforcementResult,
    failOnWarn: options.failOnWarn,
  })

  if (failed) {
    console.error("")
    console.error("❌ Registry check FAILED")
    console.error("")
    if (enforcementResult.failures.length > 0) {
      console.error("Failures (must fix before merge):")
      for (const f of enforcementResult.failures) {
        console.error(`  ❌ ${f.componentId} (${f.type}): ${f.message}`)
      }
    }
    process.exit(1)
  } else {
    console.error("")
    console.error("✅ Registry check PASSED")
    if (enforcementResult.warnings.length > 0) {
      console.error("")
      console.error("Warnings (should address soon):")
      for (const w of enforcementResult.warnings) {
        console.error(`  ⚠️  ${w.componentId} (${w.type}): ${w.message}`)
      }
    }
    process.exit(0)
  }
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
