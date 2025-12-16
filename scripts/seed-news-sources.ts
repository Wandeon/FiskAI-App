#!/usr/bin/env tsx
// scripts/seed-news-sources.ts

import { drizzleDb } from "../src/lib/db/drizzle"
import { newsSources } from "../src/lib/db/schema"
import { newsSources as sourceData } from "../src/lib/news/sources"

async function seedNewsSources() {
  console.log("🌱 Seeding news sources...")

  try {
    let inserted = 0
    let updated = 0

    for (const source of sourceData) {
      // Try to insert, on conflict do nothing (or you can update)
      try {
        await drizzleDb.insert(newsSources).values(source)
        inserted++
        console.log(`✓ Inserted: ${source.name}`)
      } catch (error) {
        // If it already exists, we can update it
        try {
          await drizzleDb
            .update(newsSources)
            .set({
              ...source,
              updatedAt: new Date(),
            })
            .where((table: any) => table.id.equals(source.id))

          updated++
          console.log(`↻ Updated: ${source.name}`)
        } catch (updateError) {
          console.error(`✗ Error with ${source.name}:`, updateError)
        }
      }
    }

    console.log(`\n✅ Seeding complete!`)
    console.log(`   Inserted: ${inserted}`)
    console.log(`   Updated: ${updated}`)
    console.log(`   Total: ${sourceData.length}`)

    process.exit(0)
  } catch (error) {
    console.error("❌ Error seeding news sources:", error)
    process.exit(1)
  }
}

seedNewsSources()
