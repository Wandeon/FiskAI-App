#!/usr/bin/env npx tsx
/**
 * History Capture Script
 *
 * CI script to capture drift history from the current registry check run.
 * Appends new drift entries to the JSONL history file.
 *
 * Usage:
 *   npx tsx src/lib/system-registry/scripts/history-capture.ts
 *
 * Options:
 *   --run-id <id>     Specify a custom run ID (default: auto-generated)
 *   --history-file <path>  Path to history file (default: docs/system-registry/drift-history.jsonl)
 *   --dry-run         Print entries without writing to file
 *   --json            Output captured entries as JSON
 *   --summary         Show summary after capture
 *
 * Environment:
 *   GITHUB_RUN_ID     GitHub Actions run ID (used for run-id if not specified)
 *   CI                Set to "true" in CI environment
 */

import { randomUUID } from "crypto"
import { harvestAll } from "../harvesters"
import { computeDrift, HARVESTED_TYPES } from "../compute-drift"
import { ALL_COMPONENTS as DECLARED_COMPONENTS } from "../declarations"
import {
  captureDriftToHistory,
  readDriftHistory,
  calculateDriftHistorySummary,
  DEFAULT_HISTORY_FILE,
  type DriftHistoryEntry,
} from "../exporters/drift-history"
import type { DriftEntry } from "../schema"

// =============================================================================
// TYPES
// =============================================================================

interface Options {
  runId: string
  historyFile: string
  dryRun: boolean
  json: boolean
  showSummary: boolean
  projectRoot: string
}

// =============================================================================
// ARGUMENT PARSING
// =============================================================================

function parseArgs(): Options {
  const args = process.argv.slice(2)

  // Generate default run ID
  let runId = process.env.GITHUB_RUN_ID || randomUUID().slice(0, 8)

  // Parse --run-id
  const runIdIndex = args.indexOf("--run-id")
  if (runIdIndex !== -1 && args[runIdIndex + 1]) {
    runId = args[runIdIndex + 1]
  }

  // Parse --history-file
  let historyFile = DEFAULT_HISTORY_FILE
  const historyFileIndex = args.indexOf("--history-file")
  if (historyFileIndex !== -1 && args[historyFileIndex + 1]) {
    historyFile = args[historyFileIndex + 1]
  }

  // Parse project root (first non-option argument)
  const projectRoot = args.find((a) => !a.startsWith("--") && a !== runId && a !== historyFile) || process.cwd()

  return {
    runId,
    historyFile,
    dryRun: args.includes("--dry-run"),
    json: args.includes("--json"),
    showSummary: args.includes("--summary"),
    projectRoot,
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Collect all drift entries that should be captured to history.
 */
function collectDriftEntries(driftResult: ReturnType<typeof computeDrift>): DriftEntry[] {
  const entries: DriftEntry[] = []

  // Add observed not declared
  entries.push(...driftResult.observedNotDeclared)

  // Add declared not observed
  entries.push(...driftResult.declaredNotObserved)

  // Add metadata gaps
  entries.push(...driftResult.metadataGaps)

  // Add codeRef invalid
  entries.push(...driftResult.codeRefInvalid)

  // Add unknown integrations
  entries.push(...driftResult.unknownIntegrations)

  return entries
}

/**
 * Format a summary of captured entries.
 */
function formatSummary(entries: DriftHistoryEntry[], historyFile: string, projectRoot: string): string {
  const lines: string[] = []

  // Read full history to show overall stats
  const allEntries = readDriftHistory(historyFile, projectRoot)
  const summary = calculateDriftHistorySummary(allEntries)

  lines.push("")
  lines.push("Drift History Summary")
  lines.push("=====================")
  lines.push("")
  lines.push(`Total entries in history: ${summary.totalEntries}`)
  lines.push(`Unresolved issues: ${summary.unresolvedCount}`)
  lines.push(`Resolved issues: ${summary.resolvedCount}`)
  lines.push("")
  lines.push("By Severity:")
  lines.push(`  CRITICAL: ${summary.bySeverity.CRITICAL}`)
  lines.push(`  HIGH: ${summary.bySeverity.HIGH}`)
  lines.push(`  MEDIUM: ${summary.bySeverity.MEDIUM}`)
  lines.push(`  LOW: ${summary.bySeverity.LOW}`)
  lines.push("")
  lines.push("By Issue Type:")
  for (const [issue, count] of Object.entries(summary.byIssue).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${issue}: ${count}`)
  }
  lines.push("")
  if (summary.oldestEntry) {
    lines.push(`Oldest entry: ${summary.oldestEntry}`)
  }
  if (summary.newestEntry) {
    lines.push(`Newest entry: ${summary.newestEntry}`)
  }

  return lines.join("\n")
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const options = parseArgs()
  const startTime = Date.now()

  if (!options.json) {
    console.error("Drift History Capture")
    console.error("=====================")
    console.error("")
    console.error(`Run ID: ${options.runId}`)
    console.error(`History file: ${options.historyFile}`)
    console.error(`Project root: ${options.projectRoot}`)
    console.error(`Dry run: ${options.dryRun}`)
    console.error("")
  }

  // Step 1: Harvest components
  if (!options.json) {
    console.error("Harvesting observed components...")
    console.error(`All types harvested: ${HARVESTED_TYPES.join(", ")}`)
  }

  const harvestResult = await harvestAll(options.projectRoot)

  if (!options.json) {
    console.error(`Found ${harvestResult.components.length} components`)
    console.error("")
  }

  // Step 2: Compute drift
  if (!options.json) {
    console.error("Computing drift...")
  }

  const driftResult = computeDrift(
    harvestResult.components,
    DECLARED_COMPONENTS,
    options.projectRoot
  )

  if (!options.json) {
    console.error(`Observed not declared: ${driftResult.summary.observedNotDeclaredCount}`)
    console.error(`Declared not observed: ${driftResult.summary.declaredNotObservedCount}`)
    console.error(`Metadata gaps: ${driftResult.summary.metadataGapCount}`)
    console.error(`CodeRef invalid: ${driftResult.summary.codeRefInvalidCount}`)
    console.error(`Unknown integrations: ${driftResult.summary.unknownIntegrationCount}`)
    console.error("")
  }

  // Step 3: Collect drift entries
  const driftEntries = collectDriftEntries(driftResult)

  if (!options.json) {
    console.error(`Total drift entries to capture: ${driftEntries.length}`)
    console.error("")
  }

  // Step 4: Capture to history
  let capturedEntries: DriftHistoryEntry[] = []

  if (driftEntries.length > 0) {
    if (options.dryRun) {
      if (!options.json) {
        console.error("DRY RUN - would capture the following entries:")
        console.error("")
      }

      const timestamp = new Date().toISOString()
      capturedEntries = driftEntries.map((d) => ({
        timestamp,
        runId: options.runId,
        component: d.componentId,
        issue: mapDriftTypeToIssue(d.driftType, d.gaps),
        severity: d.risk,
        resolved: false,
      }))
    } else {
      if (!options.json) {
        console.error("Capturing drift entries to history...")
      }

      capturedEntries = captureDriftToHistory(
        driftEntries,
        options.runId,
        options.historyFile,
        options.projectRoot
      )

      if (!options.json) {
        console.error(`Captured ${capturedEntries.length} entries`)
        console.error("")
      }
    }
  } else {
    if (!options.json) {
      console.error("No drift entries to capture")
      console.error("")
    }
  }

  // Step 5: Output results
  if (options.json) {
    console.log(
      JSON.stringify(
        {
          runId: options.runId,
          historyFile: options.historyFile,
          dryRun: options.dryRun,
          capturedCount: capturedEntries.length,
          entries: capturedEntries,
          durationMs: Date.now() - startTime,
        },
        null,
        2
      )
    )
  } else {
    // Print captured entries
    if (capturedEntries.length > 0) {
      console.error("Captured Entries:")
      console.error("-----------------")
      for (const entry of capturedEntries) {
        console.error(
          `  [${entry.severity}] ${entry.component}: ${entry.issue}`
        )
      }
      console.error("")
    }

    // Show summary if requested
    if (options.showSummary) {
      console.error(formatSummary(capturedEntries, options.historyFile, options.projectRoot))
    }

    console.error(`Duration: ${Date.now() - startTime}ms`)
  }

  // Exit with 0 - capturing history should not fail the build
  process.exit(0)
}

/**
 * Map drift type to history issue type.
 */
function mapDriftTypeToIssue(
  driftType: DriftEntry["driftType"],
  gaps?: DriftEntry["gaps"]
): DriftHistoryEntry["issue"] {
  switch (driftType) {
    case "OBSERVED_NOT_DECLARED":
      return "observed_not_declared"
    case "DECLARED_NOT_OBSERVED":
      return "declared_not_observed"
    case "CODEREF_INVALID":
      return "coderef_invalid"
    case "METADATA_GAP":
      if (gaps?.includes("NO_OWNER")) {
        return "owner_missing"
      }
      if (gaps?.includes("NO_DOCS")) {
        return "docs_missing"
      }
      return "metadata_gap"
    default:
      return "metadata_gap"
  }
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
