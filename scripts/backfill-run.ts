#!/usr/bin/env npx tsx
/**
 * Backfill Run CLI Script
 *
 * Create and run a historical backfill discovery session.
 *
 * Usage:
 *   npx tsx scripts/backfill-run.ts --source narodne-novine --mode sitemap --max-urls 500 --dry-run
 *
 * Options:
 *   --source <slug>      Source slug to backfill (required, can be repeated)
 *   --mode <mode>        Discovery mode: sitemap, pagination, archive (default: sitemap)
 *   --max-urls <n>       Maximum URLs to discover (default: 500)
 *   --delay-ms <n>       Delay between requests in ms (default: 5000)
 *   --date-from <date>   Only include URLs modified after this date (YYYY-MM-DD)
 *   --date-to <date>     Only include URLs modified before this date (YYYY-MM-DD)
 *   --dry-run            Preview what would be discovered without creating records
 *   --list-sources       List available source configurations
 *   --help               Show this help message
 *
 * Environment:
 *   BACKFILL_ENABLED=true  Required to run (kill switch)
 *
 * Examples:
 *   # List available sources
 *   npx tsx scripts/backfill-run.ts --list-sources
 *
 *   # Dry run for narodne-novine
 *   npx tsx scripts/backfill-run.ts --source narodne-novine --mode sitemap --max-urls 100 --dry-run
 *
 *   # Real run with date filter
 *   BACKFILL_ENABLED=true npx tsx scripts/backfill-run.ts \\
 *     --source narodne-novine \\
 *     --mode sitemap \\
 *     --max-urls 500 \\
 *     --date-from 2024-01-01
 */

import { parseArgs } from "util"
import { BackfillMode } from "@prisma/client"
import {
  runBackfillDiscovery,
  isBackfillEnabled,
  getConfiguredSourceSlugs,
  getBackfillConfig,
} from "../src/lib/regulatory-truth/backfill"

// Parse command line arguments
const { values } = parseArgs({
  options: {
    source: { type: "string", multiple: true },
    mode: { type: "string", default: "sitemap" },
    "max-urls": { type: "string", default: "500" },
    "delay-ms": { type: "string", default: "5000" },
    "date-from": { type: "string" },
    "date-to": { type: "string" },
    "dry-run": { type: "boolean", default: false },
    "list-sources": { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
  allowPositionals: true,
})

// Show help
if (values.help) {
  console.log(`
Backfill Run CLI - Historical RTL Discovery

Usage:
  npx tsx scripts/backfill-run.ts [options]

Options:
  --source <slug>      Source slug to backfill (required, can be repeated)
  --mode <mode>        Discovery mode: sitemap, pagination, archive (default: sitemap)
  --max-urls <n>       Maximum URLs to discover (default: 500)
  --delay-ms <n>       Delay between requests in ms (default: 5000)
  --date-from <date>   Only include URLs modified after this date (YYYY-MM-DD)
  --date-to <date>     Only include URLs modified before this date (YYYY-MM-DD)
  --dry-run            Preview what would be discovered without creating records
  --list-sources       List available source configurations
  --help               Show this help message

Environment:
  BACKFILL_ENABLED=true  Required to run (kill switch)

Examples:
  # List available sources
  npx tsx scripts/backfill-run.ts --list-sources

  # Dry run for narodne-novine
  npx tsx scripts/backfill-run.ts --source narodne-novine --max-urls 100 --dry-run

  # Real run with date filter
  BACKFILL_ENABLED=true npx tsx scripts/backfill-run.ts \\
    --source narodne-novine \\
    --mode sitemap \\
    --max-urls 500 \\
    --date-from 2024-01-01
`)
  process.exit(0)
}

// List sources
if (values["list-sources"]) {
  console.log("\nConfigured Backfill Sources:\n")

  const slugs = getConfiguredSourceSlugs()
  for (const slug of slugs) {
    const config = getBackfillConfig(slug)
    if (config) {
      console.log(`  ${slug}`)
      console.log(`    Domain: ${config.domain}`)
      console.log(`    Mode: ${config.mode}`)
      console.log(`    URL: ${config.sitemapUrl || config.archiveUrl || "N/A"}`)
      console.log(
        `    Rate limit: ${config.rateLimit.minDelayMs}ms - ${config.rateLimit.maxDelayMs}ms`
      )
      console.log()
    }
  }

  process.exit(0)
}

// Validate required arguments
if (!values.source || values.source.length === 0) {
  console.error("Error: --source is required")
  console.error("Use --list-sources to see available sources")
  console.error("Use --help for usage information")
  process.exit(1)
}

// Parse mode
function parseMode(mode: string): BackfillMode {
  const normalized = mode.toUpperCase()
  if (normalized === "SITEMAP") return BackfillMode.SITEMAP
  if (normalized === "PAGINATION") return BackfillMode.PAGINATION
  if (normalized === "ARCHIVE") return BackfillMode.ARCHIVE
  throw new Error(`Invalid mode: ${mode}. Must be: sitemap, pagination, or archive`)
}

// Parse date
function parseDate(dateStr: string | undefined): Date | undefined {
  if (!dateStr) return undefined
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateStr}. Use YYYY-MM-DD`)
  }
  return date
}

// Main execution
async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗")
  console.log("║                  BACKFILL DISCOVERY RUN                      ║")
  console.log("╚══════════════════════════════════════════════════════════════╝\n")

  // Check kill switch
  if (!values["dry-run"] && !isBackfillEnabled()) {
    console.error("ERROR: Backfill is disabled.")
    console.error("")
    console.error("To enable backfill, set BACKFILL_ENABLED=true in your environment:")
    console.error("  BACKFILL_ENABLED=true npx tsx scripts/backfill-run.ts ...")
    console.error("")
    console.error("For dry run (no records created), use --dry-run flag:")
    console.error("  npx tsx scripts/backfill-run.ts --source ... --dry-run")
    process.exit(1)
  }

  const sources = values.source as string[]
  const mode = parseMode(values.mode as string)
  const maxUrls = parseInt(values["max-urls"] as string, 10)
  const delayMs = parseInt(values["delay-ms"] as string, 10)
  const dateFrom = parseDate(values["date-from"])
  const dateTo = parseDate(values["date-to"])
  const dryRun = values["dry-run"] as boolean

  // Show configuration
  console.log("Configuration:")
  console.log(`  Sources: ${sources.join(", ")}`)
  console.log(`  Mode: ${mode}`)
  console.log(`  Max URLs: ${maxUrls}`)
  console.log(`  Delay: ${delayMs}ms`)
  console.log(`  Date from: ${dateFrom ? dateFrom.toISOString().split("T")[0] : "N/A"}`)
  console.log(`  Date to: ${dateTo ? dateTo.toISOString().split("T")[0] : "N/A"}`)
  console.log(`  Dry run: ${dryRun}`)
  console.log()

  if (dryRun) {
    console.log("─────────────────────────────────────────────────────────────────")
    console.log("  DRY RUN MODE - No records will be created")
    console.log("─────────────────────────────────────────────────────────────────")
    console.log()
  }

  // Run backfill
  try {
    const result = await runBackfillDiscovery({
      sources,
      mode,
      dateFrom,
      dateTo,
      maxUrls,
      concurrency: 1,
      delayMs,
      dryRun,
      runBy: "CLI",
      notes: `CLI run: ${sources.join(", ")}`,
    })

    console.log("\n╔══════════════════════════════════════════════════════════════╗")
    console.log("║                      BACKFILL RESULTS                        ║")
    console.log("╚══════════════════════════════════════════════════════════════╝\n")

    console.log(`  Run ID: ${result.runId}`)
    console.log(`  Status: ${result.success ? "SUCCESS" : "FAILED"}`)
    console.log(`  Duration: ${(result.durationMs / 1000).toFixed(1)}s`)
    console.log()
    console.log("  Statistics:")
    console.log(`    Discovered: ${result.discoveredCount}`)
    console.log(`    Queued: ${result.queuedCount}`)
    console.log(`    Skipped: ${result.skippedCount}`)
    console.log(`    Errors: ${result.errorCount}`)
    console.log()

    if (result.errors.length > 0) {
      console.log("  Errors:")
      for (const error of result.errors.slice(0, 10)) {
        console.log(`    - [${error.source}] ${error.message}`)
      }
      if (result.errors.length > 10) {
        console.log(`    ... and ${result.errors.length - 10} more`)
      }
      console.log()
    }

    if (dryRun) {
      console.log("─────────────────────────────────────────────────────────────────")
      console.log("  This was a DRY RUN - no records were created.")
      console.log("  To create records, run without --dry-run flag and set:")
      console.log("    BACKFILL_ENABLED=true")
      console.log("─────────────────────────────────────────────────────────────────")
    }

    process.exit(result.success ? 0 : 1)
  } catch (error) {
    console.error("Backfill failed:", error)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
