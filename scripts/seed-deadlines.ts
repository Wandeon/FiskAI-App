#!/usr/bin/env tsx
// scripts/seed-deadlines.ts

import { drizzleDb } from "../src/lib/db/drizzle"
import { complianceDeadlines } from "../src/lib/db/schema"
import { croatianDeadlines } from "../src/lib/deadlines/seed-data"
import { and, eq } from "drizzle-orm"

async function seedDeadlines() {
  console.log("🌱 Seeding compliance deadlines...")

  try {
    // Clear existing deadlines (optional - comment out if you want to keep existing)
    // await drizzleDb.delete(complianceDeadlines)
    // console.log("🗑️  Cleared existing deadlines")

    let inserted = 0
    let updated = 0

    for (const deadline of croatianDeadlines) {
      try {
        const existing = await drizzleDb
          .select({ id: complianceDeadlines.id })
          .from(complianceDeadlines)
          .where(
            and(
              eq(complianceDeadlines.title, deadline.title),
              eq(complianceDeadlines.deadlineType, deadline.deadlineType)
            )
          )
          .limit(1)

        if (existing[0]?.id) {
          await drizzleDb
            .update(complianceDeadlines)
            .set({
              ...deadline,
              updatedAt: new Date(),
            })
            .where(eq(complianceDeadlines.id, existing[0].id))

          updated++
          console.log(`↻ Updated: ${deadline.title}`)
        } else {
          await drizzleDb.insert(complianceDeadlines).values(deadline)
          inserted++
          console.log(`✓ Inserted: ${deadline.title}`)
        }
      } catch (error) {
        console.error(`✗ Error inserting ${deadline.title}:`, error)
      }
    }

    console.log(`\n✅ Seeding complete!`)
    console.log(`   Inserted: ${inserted} deadlines`)
    console.log(`   Updated: ${updated} deadlines`)
    console.log(`   Total: ${croatianDeadlines.length}`)

    process.exit(0)
  } catch (error) {
    console.error("❌ Error seeding deadlines:", error)
    process.exit(1)
  }
}

seedDeadlines()
