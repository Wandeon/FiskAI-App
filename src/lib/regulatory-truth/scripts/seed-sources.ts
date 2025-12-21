// src/lib/regulatory-truth/scripts/seed-sources.ts

import { db } from "@/lib/db"
import { REGULATORY_SOURCES } from "../data/sources"

/**
 * Seed the RegulatorySource table with initial sources
 */
export async function seedRegulatorySources(): Promise<{
  created: number
  skipped: number
  errors: string[]
}> {
  let created = 0
  let skipped = 0
  const errors: string[] = []

  console.log(`[seed] Seeding ${REGULATORY_SOURCES.length} regulatory sources...`)

  for (const source of REGULATORY_SOURCES) {
    try {
      // Check if source already exists
      const existing = await db.regulatorySource.findUnique({
        where: { slug: source.slug },
      })

      if (existing) {
        console.log(`[seed] Skipping existing source: ${source.slug}`)
        skipped++
        continue
      }

      // Create new source
      await db.regulatorySource.create({
        data: {
          slug: source.slug,
          name: source.name,
          url: source.url,
          hierarchy: source.hierarchy,
          fetchIntervalHours: source.fetchIntervalHours,
          isActive: true,
        },
      })

      console.log(`[seed] Created source: ${source.slug}`)
      created++
    } catch (error) {
      const errorMsg = `Failed to seed ${source.slug}: ${error}`
      console.error(`[seed] ${errorMsg}`)
      errors.push(errorMsg)
    }
  }

  console.log(`[seed] Complete: ${created} created, ${skipped} skipped, ${errors.length} errors`)

  return { created, skipped, errors }
}

// CLI runner
if (require.main === module) {
  seedRegulatorySources()
    .then((result) => {
      console.log("[seed] Result:", result)
      process.exit(result.errors.length > 0 ? 1 : 0)
    })
    .catch((error) => {
      console.error("[seed] Fatal error:", error)
      process.exit(1)
    })
}
