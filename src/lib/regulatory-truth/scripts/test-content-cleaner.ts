// src/lib/regulatory-truth/scripts/test-content-cleaner.ts
// Test the content cleaner on actual Evidence records

import { config } from "dotenv"
import { resolve } from "path"

const envPath = resolve(process.cwd(), ".env.local")
config({ path: envPath })

import { db, dbReg } from "@/lib/db"
import { cleanContent, getCleaningStats, extractNewsItems } from "../utils/content-cleaner"

async function testContentCleaner() {
  console.log("=".repeat(80))
  console.log("CONTENT CLEANER TEST")
  console.log("=".repeat(80))

  // Get recent evidence records
  const evidence = await dbReg.evidence.findMany({
    include: { source: true },
    orderBy: { fetchedAt: "desc" },
    take: 10,
  })

  console.log(`\nFound ${evidence.length} evidence records to test\n`)

  for (const ev of evidence) {
    console.log("-".repeat(80))
    console.log(`SOURCE: ${ev.source.name}`)
    console.log(`URL: ${ev.url}`)
    console.log("-".repeat(80))

    // Clean the content
    const cleaned = cleanContent(ev.rawContent, ev.url)
    const stats = getCleaningStats(ev.rawContent, cleaned)

    console.log(`\nSTATISTICS:`)
    console.log(`  Original: ${stats.originalLength} chars`)
    console.log(`  Cleaned:  ${stats.cleanedLength} chars`)
    console.log(`  Reduction: ${stats.reductionPercent}%`)
    console.log(`  News items found: ${stats.newsItemsFound}`)

    // Show first 500 chars of cleaned content
    console.log(`\nCLEANED CONTENT (first 500 chars):`)
    console.log(cleaned.substring(0, 500))
    if (cleaned.length > 500) {
      console.log("...")
    }

    // Show extracted news items
    if (stats.newsItemsFound > 0) {
      const items = extractNewsItems(cleaned)
      console.log(`\nEXTRACTED NEWS ITEMS (first 3):`)
      for (const item of items.slice(0, 3)) {
        console.log(
          `  ${item.date} | ${item.category || "N/A"} | ${item.title.substring(0, 60)}...`
        )
      }
    }

    console.log("\n")
  }

  // Summary
  console.log("=".repeat(80))
  console.log("SUMMARY")
  console.log("=".repeat(80))

  let totalOriginal = 0
  let totalCleaned = 0
  let totalItems = 0

  for (const ev of evidence) {
    const cleaned = cleanContent(ev.rawContent, ev.url)
    const stats = getCleaningStats(ev.rawContent, cleaned)
    totalOriginal += stats.originalLength
    totalCleaned += stats.cleanedLength
    totalItems += stats.newsItemsFound
  }

  console.log(`Total original: ${totalOriginal} chars`)
  console.log(`Total cleaned: ${totalCleaned} chars`)
  console.log(`Overall reduction: ${Math.round((1 - totalCleaned / totalOriginal) * 100)}%`)
  console.log(`Total news items found: ${totalItems}`)
}

testContentCleaner()
  .catch(console.error)
  .finally(() => process.exit(0))
