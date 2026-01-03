import { db } from "../src/lib/db"
import { dbReg } from "../src/lib/db/regulatory"

async function checkCounts() {
  console.log("=== REGULATORY RULE COUNTS BY STATUS ===")
  const rulesByStatus =
    await db.$queryRaw`SELECT status, COUNT(*)::int as count FROM "RegulatoryRule" GROUP BY status ORDER BY count DESC`
  console.log(JSON.stringify(rulesByStatus, null, 2))

  console.log("\n=== EVIDENCE COUNT ===")
  const evidenceCount = await dbReg.evidence.count()
  console.log("Evidence records:", evidenceCount)

  console.log("\n=== SOURCE POINTER COUNT ===")
  const sourcePointerCount = await db.sourcePointer.count()
  console.log("SourcePointer records:", sourcePointerCount)

  console.log("\n=== CONCEPT COUNT ===")
  const conceptCount = await db.concept.count()
  console.log("Concept records:", conceptCount)

  console.log("\n=== SAMPLE PUBLISHED RULE WITH SOURCE POINTER ===")
  // RegulatoryRule is in core, SourcePointer/Evidence are in regulatory
  // Must query separately after RTL migration
  const sampleRule = await db.regulatoryRule.findFirst({
    where: { status: "PUBLISHED" },
    include: { concept: true },
  })
  if (sampleRule) {
    console.log("Rule ID:", sampleRule.id)
    console.log("Title:", sampleRule.titleHr)
    console.log("Concept:", sampleRule.concept?.slug)

    // Query source pointers from core DB (soft ref to Evidence in regulatory)
    const sourcePointers = await db.sourcePointer.findMany({
      where: { rules: { some: { id: sampleRule.id } } },
    })
    console.log("SourcePointers:", sourcePointers.length)
    if (sourcePointers[0]) {
      console.log("  - Quote:", sourcePointers[0].exactQuote?.substring(0, 100))
      console.log("  - Evidence ID:", sourcePointers[0].evidenceId)
      // Get evidence from regulatory DB
      const evidence = await dbReg.evidence.findUnique({
        where: { id: sourcePointers[0].evidenceId },
      })
      if (evidence) {
        console.log("  - Evidence URL:", evidence.url)
        console.log("  - FetchedAt:", evidence.fetchedAt)
      }
    }
  } else {
    console.log("NO PUBLISHED RULES FOUND")
  }

  await db.$disconnect()
  await dbReg.$disconnect()
}

checkCounts().catch(console.error)
