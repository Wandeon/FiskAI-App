import { db } from "../src/lib/db"

async function checkConflicts() {
  console.log("=== CHECKING FOR REGULATORY CONFLICTS ===\n")

  // Check if RegulatoryConflict table exists and has records
  try {
    const conflicts = await db.regulatoryConflict.findMany({
      take: 5,
      include: {
        itemA: true,
        itemB: true,
      },
    })

    console.log("Conflicts found:", conflicts.length)

    if (conflicts.length > 0) {
      for (const c of conflicts) {
        console.log("\nConflict:", c.id)
        console.log("  Status:", c.status)
        console.log("  Item A:", c.itemA?.id)
        console.log("  Item B:", c.itemB?.id)
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.log("RegulatoryConflict table check failed:", errorMessage)
  }

  // Check for rules with overlapping concepts that might conflict
  console.log("\n=== CHECKING FOR POTENTIAL CONFLICTS (same concept, different values) ===\n")

  const rulesWithConcepts = await db.regulatoryRule.findMany({
    where: { status: "PUBLISHED" },
    include: { concept: true },
    orderBy: { conceptId: "asc" },
  })

  // Group by concept
  const byConceptId: Record<string, typeof rulesWithConcepts> = {}
  for (const r of rulesWithConcepts) {
    if (r.conceptId === null) continue
    if (!byConceptId[r.conceptId]) byConceptId[r.conceptId] = []
    byConceptId[r.conceptId].push(r)
  }

  // Find concepts with multiple rules
  let hasMultipleRules = false
  for (const [conceptId, rules] of Object.entries(byConceptId)) {
    if (rules.length > 1) {
      hasMultipleRules = true
      console.log(`Concept ${rules[0].concept?.slug} has ${rules.length} rules:`)
      for (const r of rules) {
        console.log(`  - ${r.titleHr}: value="${r.value}" (${r.valueType})`)
      }
      console.log("")
    }
  }

  if (!hasMultipleRules) {
    console.log("No concepts with multiple rules found (no potential conflicts).")
  }

  await db.$disconnect()
}

checkConflicts().catch(console.error)
