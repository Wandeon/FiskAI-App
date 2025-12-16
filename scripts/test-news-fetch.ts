// scripts/test-news-fetch.ts
// Test script to verify RSS feed fetching

import { fetchAllNews } from "../src/lib/news/fetcher"

async function main() {
  console.log("Fetching news from all sources...")

  const result = await fetchAllNews()

  console.log("\nResults:")
  console.log(`  Total fetched: ${result.totalFetched}`)
  console.log(`  Inserted: ${result.totalInserted}`)
  console.log(`  Skipped: ${result.totalSkipped}`)
  console.log(`  Errors: ${JSON.stringify(result.errors, null, 2)}`)

  process.exit(0)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
