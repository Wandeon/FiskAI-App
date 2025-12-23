// scripts/diagnose-hashes.ts
import { db } from "../src/lib/db"
import { createHash } from "crypto"

async function diagnose() {
  // INV-1: Check hash mismatches
  const evidence = await db.evidence.findMany({
    select: { id: true, contentHash: true, rawContent: true, contentType: true },
  })

  console.log("=== INV-1: Evidence Hash Analysis ===")
  let htmlMatch = 0,
    htmlMismatch = 0
  let jsonMatch = 0,
    jsonMismatch = 0

  for (const e of evidence) {
    const computed = createHash("sha256").update(e.rawContent).digest("hex")
    const isMatch = computed === e.contentHash

    if (e.contentType === "html") {
      if (isMatch) htmlMatch++
      else htmlMismatch++
    } else {
      if (isMatch) jsonMatch++
      else jsonMismatch++
    }
  }

  console.log(`HTML: ${htmlMatch} match, ${htmlMismatch} mismatch`)
  console.log(`JSON: ${jsonMatch} match, ${jsonMismatch} mismatch`)
  console.log(`Total: ${htmlMatch + jsonMatch} match, ${htmlMismatch + jsonMismatch} mismatch`)

  // INV-5: Check release hash algorithm
  const releases = await db.ruleRelease.findMany({
    include: { rules: { orderBy: { conceptSlug: "asc" } } },
  })

  console.log("\n=== INV-5: Release Hash Analysis ===")
  for (const release of releases) {
    console.log(`\nRelease ${release.version}: ${release.rules.length} rules`)
    console.log(`Stored hash: ${release.contentHash}`)

    // Try the approach I used in invariant-validator
    const rulesV1 = release.rules.map((r) => ({
      conceptSlug: r.conceptSlug,
      value: r.value,
      valueType: r.valueType,
      effectiveFrom: r.effectiveFrom?.toISOString().split("T")[0] || null,
      effectiveUntil: r.effectiveUntil?.toISOString().split("T")[0] || null,
    }))
    const hashV1 = createHash("sha256").update(JSON.stringify(rulesV1)).digest("hex")
    console.log(`My validator: ${hashV1}`)

    // Try with IDs only
    const ruleIds = release.rules.map((r) => r.id).sort()
    const hashV2 = createHash("sha256").update(JSON.stringify(ruleIds)).digest("hex")
    console.log(`IDs only:     ${hashV2}`)

    // Try full rule objects
    const hashV3 = createHash("sha256").update(JSON.stringify(release.rules)).digest("hex")
    console.log(`Full objects: ${hashV3}`)
  }

  await db.$disconnect()
}

diagnose().catch(console.error)
