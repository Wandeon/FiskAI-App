#!/usr/bin/env npx tsx
// Quick duplicate check script

import { db } from "@/lib/db"

async function check() {
  const rules = await db.regulatoryRule.findMany({
    where: { status: { not: "REJECTED" } },
    select: { id: true, conceptSlug: true, value: true, valueType: true, status: true },
  })

  const groups = new Map<string, typeof rules>()
  for (const r of rules) {
    const key = `${r.value}|${r.valueType}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }

  console.log("Potential duplicate groups (same value + valueType):\n")
  let count = 0
  for (const [key, items] of groups) {
    if (items.length > 1) {
      count++
      const [value, type] = key.split("|")
      console.log(`[${count}] Value: "${value}" (${type})`)
      for (const r of items) {
        console.log(`    - ${r.conceptSlug} (${r.status})`)
      }
      console.log()
    }
  }

  if (count === 0) {
    console.log("No duplicates found!")
  } else {
    console.log(`Total: ${count} potential duplicate groups`)
    console.log("\nNote: These may be INTENTIONAL (different concepts with same value)")
  }

  await db.$disconnect()
}

check().catch(console.error)
