#!/usr/bin/env tsx
// scripts/seed-deadlines.ts

import { drizzleDb } from "../src/lib/db/drizzle"
import { complianceDeadlines } from "../src/lib/db/schema"
import { croatianDeadlines } from "../src/lib/deadlines/seed-data"

async function seedDeadlines() {
  console.log("🌱 Seeding compliance deadlines...")

  try {
    // Clear existing deadlines (optional - comment out if you want to keep existing)
    // await drizzleDb.delete(complianceDeadlines)
    // console.log("🗑️  Cleared existing deadlines")

    let inserted = 0

    for (const deadline of croatianDeadlines) {
      try {
        await drizzleDb.insert(complianceDeadlines).values(deadline)
        inserted++
        console.log(`✓ Inserted: ${deadline.title}`)
      } catch (error) {
        console.error(`✗ Error inserting ${deadline.title}:`, error)
      }
    }

    console.log(`\n✅ Seeding complete!`)
    console.log(`   Inserted: ${inserted} deadlines`)
    console.log(`   Total: ${croatianDeadlines.length}`)

    process.exit(0)
  } catch (error) {
    console.error("❌ Error seeding deadlines:", error)
    process.exit(1)
  }
}

seedDeadlines()
