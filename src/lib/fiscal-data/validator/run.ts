/**
 * Fiscal Data Validator - Entry Point
 *
 * Orchestrates weekly validation of Croatian fiscal data sources.
 * Creates PRs when high-confidence changes are detected.
 *
 * Environment:
 *   DRY_RUN=true - Skip PR creation
 *   OLLAMA_ENDPOINT - LLM endpoint for analysis
 *   OLLAMA_MODEL - Model to use
 *   GITHUB_TOKEN - For PR creation
 */

import { writeFileSync } from "fs"
import { validateAllSources, getValidationSummary, getChangesForPR } from "./validate"
import { createUpdatePR } from "./create-pr"

interface ValidationReport {
  timestamp: string
  sourcesChecked: number
  changesDetected: number
  highConfidenceChanges: number
  prCreated: boolean
  prUrl: string | null
  errors: string[]
}

async function main(): Promise<void> {
  const isDryRun = process.env.DRY_RUN === "true"

  console.log("=== Fiscal Data Validator ===")
  console.log(`Mode: ${isDryRun ? "DRY RUN" : "LIVE"}`)
  console.log(`Started: ${new Date().toISOString()}`)
  console.log("")

  const report: ValidationReport = {
    timestamp: new Date().toISOString(),
    sourcesChecked: 0,
    changesDetected: 0,
    highConfidenceChanges: 0,
    prCreated: false,
    prUrl: null,
    errors: [],
  }

  try {
    // Run validation on primary sources
    console.log("Validating primary sources...")
    const results = await validateAllSources(true)

    const summary = getValidationSummary(results)
    const highConfidenceChanges = getChangesForPR(results)

    report.sourcesChecked = summary.total
    report.changesDetected = summary.mismatches
    report.highConfidenceChanges = highConfidenceChanges.length

    console.log(`Sources checked: ${report.sourcesChecked}`)
    console.log(`Changes detected: ${report.changesDetected}`)
    console.log(`High-confidence changes: ${report.highConfidenceChanges}`)
    console.log("")

    // Create PR if changes detected and not dry run
    if (highConfidenceChanges.length > 0) {
      if (isDryRun) {
        console.log("DRY RUN: Skipping PR creation")
        console.log("Changes that would be included:")
        for (const change of highConfidenceChanges) {
          console.log(`  - ${change.dataPoint}: ${change.currentValue} -> ${change.foundValue}`)
        }
      } else {
        console.log("Creating PR for fiscal data updates...")
        const prUrl = await createUpdatePR(highConfidenceChanges)
        if (prUrl) {
          report.prCreated = true
          report.prUrl = prUrl
          console.log(`PR created: ${prUrl}`)
        } else {
          console.log("No PR created (possibly no meaningful changes)")
        }
      }
    } else {
      console.log("No high-confidence changes detected. No action needed.")
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    report.errors.push(message)
    console.error("Validation failed:", message)
    if (error instanceof Error && error.stack) {
      console.error(error.stack)
    }
  }

  // Write report
  console.log("")
  console.log("Writing validation report...")
  writeFileSync("validation-report.json", JSON.stringify(report, null, 2))
  console.log("Report written to validation-report.json")

  // Exit with error if there were failures
  if (report.errors.length > 0) {
    console.error(`\nCompleted with ${report.errors.length} error(s)`)
    process.exit(1)
  }

  console.log("\nValidation completed successfully")
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
