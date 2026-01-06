#!/usr/bin/env npx tsx
// scripts/baseline-extraction.ts
// Bounded baseline extraction job - processes existing Evidence to create SourcePointers
//
// Discovery v1 FROZEN: This script does NOT fetch new content from the web.
// It ONLY processes existing Evidence records that:
//   1. Have COMPLETED embeddings
//   2. Are from LOCKED sources (not HNB, HGK, EUR-Lex)
//   3. Don't already have SourcePointers
//
// Usage:
//   npx tsx scripts/baseline-extraction.ts --dry-run   # Preview without processing
//   npx tsx scripts/baseline-extraction.ts --limit 10  # Process up to 10 records
//   npx tsx scripts/baseline-extraction.ts             # Process up to 200 records (default)

import { config } from "dotenv"
import { Pool } from "pg"

// Load environment variables
// Priority: .env.local (local dev) > .env (production)
config({ path: ".env" })
config({ path: ".env.local", override: true })

// Verify we have required env vars
if (!process.env.DATABASE_URL && !process.env.REGULATORY_DATABASE_URL) {
  console.error("ERROR: Neither DATABASE_URL nor REGULATORY_DATABASE_URL is set")
  process.exit(1)
}

// ENVIRONMENT DETECTION:
// If running from host machine (not in Docker), need to use localhost:5434
// instead of fiskai-db:5432 which is only resolvable inside Docker network
function getHostAccessibleUrl(url: string): string {
  // If running inside Docker, use original URL
  if (process.env.DOCKER_CONTAINER === "true") {
    return url
  }
  // Replace Docker container hostname with localhost and port
  return url.replace("fiskai-db:5432", "localhost:5434")
}

// Apply host-accessible URLs
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = getHostAccessibleUrl(process.env.DATABASE_URL)
}
if (process.env.REGULATORY_DATABASE_URL) {
  process.env.REGULATORY_DATABASE_URL = getHostAccessibleUrl(process.env.REGULATORY_DATABASE_URL)
}

// === SAFETY GUARDS ===
const MAX_BATCH_SIZE = 200 // Hard cap per user requirement
const DEFAULT_BATCH_SIZE = 200
const RATE_LIMIT_MS = 5000 // 5 seconds between API calls

// Discovery v1 EXCLUDED sources - DO NOT EXTRACT from these
const EXCLUDED_DOMAINS = ["hnb.hr", "hgk.hr", "eur-lex.europa.eu"]

interface Evidence {
  id: string
  url: string
  sourceSlug: string
  sourceName: string
  contentClass: string
  embeddingStatus: string
}

interface ExtractionMetrics {
  startTime: Date
  endTime?: Date
  totalFound: number
  processed: number
  succeeded: number
  failed: number
  skipped: number
  pointersCreated: number
  errors: Array<{ evidenceId: string; error: string }>
  bySource: Record<string, { processed: number; succeeded: number; pointers: number }>
}

/**
 * Check if a URL belongs to an excluded domain
 */
function isExcludedUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return EXCLUDED_DOMAINS.some((domain) => hostname.includes(domain))
  } catch {
    return false
  }
}

// Content classes that have extractable text without OCR
const EXTRACTABLE_CONTENT_CLASSES = ["HTML", "PDF_TEXT"]

/**
 * Find Evidence eligible for baseline extraction
 * Only selects Evidence with extractable content (HTML, PDF_TEXT)
 * Skips PDF_SCANNED, DOC, XLSX which need OCR first
 */
async function findEligibleEvidence(pool: Pool, limit: number): Promise<Evidence[]> {
  const client = await pool.connect()
  try {
    const result = await client.query(
      `
      SELECT
        e.id,
        e.url,
        e."contentClass",
        e."embeddingStatus",
        s.slug as "sourceSlug",
        s.name as "sourceName"
      FROM regulatory."Evidence" e
      JOIN regulatory."RegulatorySource" s ON e."sourceId" = s.id
      WHERE e."embeddingStatus" = 'COMPLETED'
        AND e."deletedAt" IS NULL
        AND e."contentClass" IN ('HTML', 'PDF_TEXT')
        AND NOT EXISTS (
          SELECT 1 FROM public."SourcePointer" sp
          WHERE sp."evidenceId" = e.id
          AND sp."deletedAt" IS NULL
        )
      ORDER BY e."fetchedAt" DESC
      LIMIT $1
      `,
      [limit]
    )
    return result.rows
  } finally {
    client.release()
  }
}

/**
 * Get current counts for reporting
 */
async function getCounts(pool: Pool): Promise<{
  totalEvidence: number
  withPointers: number
  eligibleForExtraction: number
  needsOcr: number
}> {
  const client = await pool.connect()
  try {
    const result = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM regulatory."Evidence" WHERE "deletedAt" IS NULL) as "totalEvidence",
        (SELECT COUNT(DISTINCT "evidenceId") FROM public."SourcePointer" WHERE "deletedAt" IS NULL) as "withPointers",
        (SELECT COUNT(*) FROM regulatory."Evidence" e
         WHERE e."embeddingStatus" = 'COMPLETED'
           AND e."deletedAt" IS NULL
           AND e."contentClass" IN ('HTML', 'PDF_TEXT')
           AND NOT EXISTS (
             SELECT 1 FROM public."SourcePointer" sp
             WHERE sp."evidenceId" = e.id
             AND sp."deletedAt" IS NULL
           )
        ) as "eligibleForExtraction",
        (SELECT COUNT(*) FROM regulatory."Evidence" e
         WHERE e."embeddingStatus" = 'COMPLETED'
           AND e."deletedAt" IS NULL
           AND e."contentClass" NOT IN ('HTML', 'PDF_TEXT')
           AND NOT EXISTS (
             SELECT 1 FROM public."SourcePointer" sp
             WHERE sp."evidenceId" = e.id
             AND sp."deletedAt" IS NULL
           )
        ) as "needsOcr"
    `)
    return result.rows[0]
  } finally {
    client.release()
  }
}

async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes("--dry-run")

  let limit = DEFAULT_BATCH_SIZE
  const limitIndex = args.indexOf("--limit")
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    limit = Math.min(parseInt(args[limitIndex + 1], 10) || DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE)
  }

  console.log("=".repeat(60))
  console.log("BASELINE EXTRACTION JOB")
  console.log("=".repeat(60))
  console.log(`Mode: ${isDryRun ? "DRY RUN (no changes)" : "LIVE"}`)
  console.log(`Batch limit: ${limit} (max ${MAX_BATCH_SIZE})`)
  console.log(`Rate limit: ${RATE_LIMIT_MS}ms between API calls`)
  console.log(`Excluded sources: ${EXCLUDED_DOMAINS.join(", ")}`)
  console.log("=".repeat(60))

  const pool = new Pool({
    connectionString: process.env.REGULATORY_DATABASE_URL || process.env.DATABASE_URL,
  })

  try {
    // Pre-flight checks
    const counts = await getCounts(pool)
    console.log("\n--- PRE-FLIGHT COUNTS ---")
    console.log(`Total Evidence: ${counts.totalEvidence}`)
    console.log(`With SourcePointers: ${counts.withPointers}`)
    console.log(`Eligible for extraction (HTML/PDF_TEXT): ${counts.eligibleForExtraction}`)
    console.log(`Needs OCR first (PDF_SCANNED/DOC/XLSX): ${counts.needsOcr}`)

    if (counts.eligibleForExtraction === 0) {
      console.log("\n✓ No extractable evidence found. All caught up!")
      if (counts.needsOcr > 0) {
        console.log(`  Note: ${counts.needsOcr} records need OCR before extraction.`)
      }
      await pool.end()
      process.exit(0)
    }

    // Find eligible evidence
    const evidence = await findEligibleEvidence(pool, limit)
    console.log(`\nFound ${evidence.length} evidence records to process`)

    // Filter out excluded sources
    const filtered = evidence.filter((e) => {
      if (isExcludedUrl(e.url)) {
        console.log(`  SKIP (excluded domain): ${e.url}`)
        return false
      }
      return true
    })

    console.log(`After filtering: ${filtered.length} records`)

    if (isDryRun) {
      console.log("\n--- DRY RUN: Would process these records ---")
      for (const e of filtered) {
        console.log(`  ${e.sourceSlug}: ${e.url.slice(0, 80)}...`)
      }
      console.log("\n✓ Dry run complete. No changes made.")
      await pool.end()
      process.exit(0)
    }

    // Initialize metrics
    const metrics: ExtractionMetrics = {
      startTime: new Date(),
      totalFound: filtered.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      pointersCreated: 0,
      errors: [],
      bySource: {},
    }

    // Dynamic import after env is loaded
    const { runExtractor } = await import("../src/lib/regulatory-truth/agents/extractor")

    // Process each evidence record
    for (let i = 0; i < filtered.length; i++) {
      const e = filtered[i]
      const progress = `[${i + 1}/${filtered.length}]`

      console.log(`\n${progress} Processing: ${e.sourceSlug}`)
      console.log(`  URL: ${e.url}`)

      // Initialize source metrics
      if (!metrics.bySource[e.sourceSlug]) {
        metrics.bySource[e.sourceSlug] = { processed: 0, succeeded: 0, pointers: 0 }
      }

      try {
        const result = await runExtractor(e.id)
        metrics.processed++
        metrics.bySource[e.sourceSlug].processed++

        if (result.success) {
          metrics.succeeded++
          metrics.pointersCreated += result.sourcePointerIds.length
          metrics.bySource[e.sourceSlug].succeeded++
          metrics.bySource[e.sourceSlug].pointers += result.sourcePointerIds.length
          console.log(`  ✓ Created ${result.sourcePointerIds.length} SourcePointers`)
        } else {
          metrics.failed++
          const errorMsg = result.error || "Unknown error"
          metrics.errors.push({ evidenceId: e.id, error: errorMsg })
          console.log(`  ✗ Failed: ${errorMsg.slice(0, 100)}`)
        }
      } catch (error) {
        metrics.failed++
        const errorMsg = error instanceof Error ? error.message : String(error)
        metrics.errors.push({ evidenceId: e.id, error: errorMsg })
        console.log(`  ✗ Error: ${errorMsg.slice(0, 100)}`)
      }

      // Rate limiting
      if (i < filtered.length - 1) {
        console.log(`  Waiting ${RATE_LIMIT_MS / 1000}s...`)
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS))
      }
    }

    metrics.endTime = new Date()
    const durationMs = metrics.endTime.getTime() - metrics.startTime.getTime()
    const durationMin = (durationMs / 60000).toFixed(1)

    // Final report
    console.log("\n" + "=".repeat(60))
    console.log("EXTRACTION COMPLETE")
    console.log("=".repeat(60))
    console.log(`Duration: ${durationMin} minutes`)
    console.log(`Processed: ${metrics.processed}/${metrics.totalFound}`)
    console.log(`Succeeded: ${metrics.succeeded}`)
    console.log(`Failed: ${metrics.failed}`)
    console.log(`SourcePointers created: ${metrics.pointersCreated}`)

    console.log("\n--- BY SOURCE ---")
    for (const [source, stats] of Object.entries(metrics.bySource).sort(
      (a, b) => b[1].pointers - a[1].pointers
    )) {
      console.log(
        `  ${source}: ${stats.succeeded}/${stats.processed} success, ${stats.pointers} pointers`
      )
    }

    if (metrics.errors.length > 0) {
      console.log("\n--- ERRORS ---")
      for (const err of metrics.errors.slice(0, 10)) {
        console.log(`  ${err.evidenceId}: ${err.error.slice(0, 80)}`)
      }
      if (metrics.errors.length > 10) {
        console.log(`  ... and ${metrics.errors.length - 10} more`)
      }
    }

    // Post-flight counts
    const postCounts = await getCounts(pool)
    console.log("\n--- POST-FLIGHT COUNTS ---")
    console.log(`Total Evidence: ${postCounts.totalEvidence}`)
    console.log(`With SourcePointers: ${postCounts.withPointers}`)
    console.log(`Remaining eligible (HTML/PDF_TEXT): ${postCounts.eligibleForExtraction}`)
    console.log(`Needs OCR: ${postCounts.needsOcr}`)

    await pool.end()
    process.exit(metrics.failed > 0 ? 1 : 0)
  } catch (error) {
    console.error("\nFATAL ERROR:", error)
    await pool.end()
    process.exit(1)
  }
}

void main()
