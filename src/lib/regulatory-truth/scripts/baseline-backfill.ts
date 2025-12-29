#!/usr/bin/env tsx
// src/lib/regulatory-truth/scripts/baseline-backfill.ts
// Recursive sitemap scanning for historical regulatory data

import { scanSitemapEntrypoint } from "../agents/sitemap-scanner"

interface BackfillStats {
  sitemapsScanned: number
  urlsDiscovered: number
  urlsNew: number
  urlsDuplicate: number
  errors: string[]
}

// Known sitemap entry points for Croatian regulatory sources
const SITEMAP_ENTRYPOINTS = [
  {
    domain: "narodne-novine.nn.hr",
    url: "https://narodne-novine.nn.hr/sitemap-index.xml",
    name: "Narodne Novine Sitemap",
    types: [1, 2, 3], // Include all types (Službeni, Međunarodni, Oglasni)
  },
  {
    domain: "porezna-uprava.gov.hr",
    url: "https://www.porezna-uprava.gov.hr/sitemap.xml",
    name: "Porezna Uprava Sitemap",
  },
  {
    domain: "hzzo.hr",
    url: "https://hzzo.hr/sitemap.xml",
    name: "HZZO Sitemap",
  },
  {
    domain: "hzmo.hr",
    url: "https://www.hzmo.hr/sitemap.xml",
    name: "HZMO Sitemap",
  },
  {
    domain: "mfin.gov.hr",
    url: "https://mfin.gov.hr/sitemap.xml",
    name: "Ministarstvo Financija Sitemap",
  },
]

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function runBaselineBackfill(): Promise<BackfillStats> {
  console.log("\n" + "=".repeat(72))
  console.log("           BASELINE BACKFILL - RECURSIVE SITEMAP SCANNING")
  console.log("=".repeat(72))

  const stats: BackfillStats = {
    sitemapsScanned: 0,
    urlsDiscovered: 0,
    urlsNew: 0,
    urlsDuplicate: 0,
    errors: [],
  }

  for (const entrypoint of SITEMAP_ENTRYPOINTS) {
    console.log(`\n[backfill] Processing: ${entrypoint.domain}`)

    const result = await scanSitemapEntrypoint(entrypoint.domain, entrypoint.url, {
      name: entrypoint.name,
      types: entrypoint.types,
    })

    // Aggregate stats
    stats.sitemapsScanned += result.sitemapsScanned
    stats.urlsDiscovered += result.urlsDiscovered
    stats.urlsNew += result.urlsRegistered
    stats.urlsDuplicate += result.urlsSkipped
    stats.errors.push(...result.errors)

    console.log(
      `[backfill] ${entrypoint.domain}: ${result.urlsRegistered} new, ${result.urlsSkipped} duplicates, ${result.errors.length} errors`
    )

    await sleep(5000) // Rate limit between domains
  }

  console.log("\n" + "=".repeat(72))
  console.log("                    BACKFILL COMPLETE")
  console.log("=".repeat(72))
  console.log("\nStats:")
  console.log(`  Sitemaps scanned: ${stats.sitemapsScanned}`)
  console.log(`  URLs discovered: ${stats.urlsDiscovered}`)
  console.log(`  New items created: ${stats.urlsNew}`)
  console.log(`  Duplicates skipped: ${stats.urlsDuplicate}`)
  console.log(`  Errors: ${stats.errors.length}`)

  if (stats.errors.length > 0) {
    console.log("\nErrors:")
    stats.errors.forEach((err) => console.log(`  - ${err}`))
  }

  return stats
}

// CLI entry point
if (require.main === module) {
  runBaselineBackfill()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Backfill failed:", err)
      process.exit(1)
    })
}
