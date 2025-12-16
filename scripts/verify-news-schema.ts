// Verification script for news system schema
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import {
  newsCategories,
  newsTags,
  newsPosts,
  newsPostSources,
  newsItems,
  type NewsCategory,
  type NewsTag,
  type NewsPost,
  type NewsPostSource,
  type NewsItem,
} from "../src/lib/db/schema/news"

async function verifySchema() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })

  const db = drizzle(pool)

  console.log("✓ Schema imports successful")
  console.log("✓ Type definitions available:")
  console.log("  - NewsCategory")
  console.log("  - NewsTag")
  console.log("  - NewsPost")
  console.log("  - NewsPostSource")
  console.log("  - NewsItem")

  console.log("\n✓ Tables available:")
  console.log("  - newsCategories")
  console.log("  - newsTags")
  console.log("  - newsPosts")
  console.log("  - newsPostSources")
  console.log("  - newsItems")

  // Test a simple query
  try {
    const categories = await db.select().from(newsCategories).limit(1)
    console.log("\n✓ Database connection working")
    console.log(`  Categories count: ${categories.length}`)
  } catch (error) {
    console.error("\n✗ Database query failed:", error)
  }

  await pool.end()
}

verifySchema().catch(console.error)
