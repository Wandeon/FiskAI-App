// src/lib/visibility/migrate-users.ts
// Migration script to set competence levels for existing users

import { db } from "@/lib/db"
import { drizzleDb } from "@/lib/db/drizzle"
import { userGuidancePreferences, COMPETENCE_LEVELS } from "@/lib/db/schema/guidance"
import { eq } from "drizzle-orm"

/**
 * Migrate existing users to have competence levels based on their activity.
 *
 * Logic:
 * - Users with invoices = "average" (they know what they're doing)
 * - Users without data = "beginner" (need hand-holding)
 *
 * This should be run once during deployment of the visibility system.
 */
export async function migrateExistingUsersCompetence(): Promise<{
  total: number
  migrated: number
  skipped: number
  errors: string[]
}> {
  const errors: string[] = []
  let migrated = 0
  let skipped = 0

  // Get all users with their company invoice counts
  const users = await db.user.findMany({
    include: {
      companies: {
        include: {
          company: {
            include: {
              _count: {
                select: { eInvoices: true },
              },
            },
          },
        },
      },
    },
  })

  console.log(`Migrating ${users.length} users...`)

  for (const user of users) {
    try {
      // Check if user already has guidance preferences with a global level set
      const existing = await drizzleDb
        .select()
        .from(userGuidancePreferences)
        .where(eq(userGuidancePreferences.userId, user.id))
        .limit(1)

      // Skip if already has a global level set (user made a choice)
      if (existing.length > 0 && existing[0].globalLevel) {
        skipped++
        continue
      }

      // Determine competence level based on invoice activity
      const hasInvoices = user.companies.some((cu) => cu.company._count.eInvoices > 0)
      const competenceLevel = hasInvoices ? COMPETENCE_LEVELS.AVERAGE : COMPETENCE_LEVELS.BEGINNER

      if (existing.length > 0) {
        // Update existing record
        await drizzleDb
          .update(userGuidancePreferences)
          .set({
            globalLevel: competenceLevel,
            levelFakturiranje: competenceLevel,
            levelFinancije: competenceLevel,
            levelEu: competenceLevel,
            updatedAt: new Date(),
          })
          .where(eq(userGuidancePreferences.userId, user.id))
      } else {
        // Create new record
        await drizzleDb.insert(userGuidancePreferences).values({
          userId: user.id,
          globalLevel: competenceLevel,
          levelFakturiranje: competenceLevel,
          levelFinancije: competenceLevel,
          levelEu: competenceLevel,
        })
      }

      migrated++
      console.log(`  Migrated ${user.email}: ${competenceLevel}`)
    } catch (error) {
      const errorMsg = `Failed to migrate user ${user.id}: ${error}`
      errors.push(errorMsg)
      console.error(errorMsg)
    }
  }

  return {
    total: users.length,
    migrated,
    skipped,
    errors,
  }
}

/**
 * Check migration status without making changes
 */
export async function checkMigrationStatus(): Promise<{
  total: number
  withCompetence: number
  withoutCompetence: number
  breakdown: Record<string, number>
}> {
  const users = await db.user.findMany({
    select: { id: true },
  })

  const preferences = await drizzleDb.select().from(userGuidancePreferences)

  const prefsMap = new Map(preferences.map((p) => [p.userId, p]))

  let withCompetence = 0
  let withoutCompetence = 0
  const breakdown: Record<string, number> = {
    beginner: 0,
    average: 0,
    pro: 0,
    none: 0,
  }

  for (const user of users) {
    const pref = prefsMap.get(user.id)
    if (pref?.globalLevel) {
      withCompetence++
      breakdown[pref.globalLevel] = (breakdown[pref.globalLevel] || 0) + 1
    } else {
      withoutCompetence++
      breakdown.none++
    }
  }

  return {
    total: users.length,
    withCompetence,
    withoutCompetence,
    breakdown,
  }
}
