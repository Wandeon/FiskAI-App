#!/usr/bin/env npx tsx
/**
 * Copy RuleVersion Bundle to Regulatory Database
 *
 * PR#10: One-time data migration from core to regulatory DB.
 *
 * Strategy:
 * - RuleTable: upsert by natural key (key), build tableIdMap
 * - RuleVersion: rewrite tableId using map, createMany skipDuplicates
 * - RuleSnapshot: copy verbatim (IDs stable)
 * - RuleCalculation: copy verbatim (IDs stable)
 *
 * Usage:
 *   npx tsx scripts/copy-ruleversion-to-regulatory.ts [--dry-run] [--chunk-size=1000]
 *
 * Options:
 *   --dry-run       Preview what would be copied without actually copying
 *   --chunk-size=N  Process N rows at a time (default: 1000)
 *
 * Prerequisites:
 * - Regulatory schema has RuleTable/RuleVersion/RuleSnapshot/RuleCalculation tables
 * - REGULATORY_DATABASE_URL is set
 *
 * Exit codes:
 *   0 = success
 *   1 = error
 */

import { db } from "../src/lib/db"
import { dbReg } from "../src/lib/db/regulatory"
import type { Prisma as PrismaReg } from "../src/generated/regulatory-client"

// Type for tableId mapping
type TableIdMap = Map<string, string> // coreTableId -> regulatoryTableId

interface CopyStats {
  ruleTables: { scanned: number; inserted: number; skipped: number }
  ruleVersions: { scanned: number; inserted: number; skipped: number }
  ruleSnapshots: { scanned: number; inserted: number; skipped: number }
  ruleCalculations: { scanned: number; inserted: number; skipped: number }
  duration: number
}

// Parse CLI args
const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const chunkSizeArg = args.find((a) => a.startsWith("--chunk-size="))
const CHUNK_SIZE = chunkSizeArg ? parseInt(chunkSizeArg.split("=")[1], 10) : 1000

console.log(`\n=== Copy RuleVersion Bundle to Regulatory DB ===`)
console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE"}`)
console.log(`Chunk size: ${CHUNK_SIZE}\n`)

async function preflightChecks(): Promise<boolean> {
  console.log("Running preflight checks...\n")

  // Check 1: Core has data
  const coreTableCount = await db.ruleTable.count()
  const coreVersionCount = await db.ruleVersion.count()
  console.log(`  Core DB: ${coreTableCount} RuleTables, ${coreVersionCount} RuleVersions`)

  if (coreTableCount === 0) {
    console.error("ERROR: Core DB has no RuleTables. Nothing to copy.")
    return false
  }

  // Check 2: Regulatory is empty OR matches core count (idempotent rerun)
  const regTableCount = await dbReg.ruleTable.count()
  const regVersionCount = await dbReg.ruleVersion.count()
  console.log(`  Regulatory DB: ${regTableCount} RuleTables, ${regVersionCount} RuleVersions`)

  if (regVersionCount > 0 && regVersionCount !== coreVersionCount) {
    console.warn(
      `\nWARNING: Regulatory has ${regVersionCount} RuleVersions but core has ${coreVersionCount}.`
    )
    console.warn("This may indicate a partial previous copy or independent data.")
    console.warn("Proceeding with upsert/skipDuplicates to make copy idempotent.\n")
  }

  // Check 3: No conflicting RuleTable keys with different semantic meaning
  // (Rare, but check anyway)
  if (regTableCount > 0) {
    const regTables = await dbReg.ruleTable.findMany({ select: { key: true, name: true } })
    const coreTables = await db.ruleTable.findMany({ select: { key: true, name: true } })

    for (const regTable of regTables) {
      const coreTable = coreTables.find((c) => c.key === regTable.key)
      if (coreTable && coreTable.name !== regTable.name) {
        console.warn(
          `  Note: RuleTable key="${regTable.key}" has different names: ` +
            `core="${coreTable.name}" vs reg="${regTable.name}". Will update to core value.`
        )
      }
    }
  }

  console.log("\nPreflight checks passed.\n")
  return true
}

async function buildRuleTableIdMap(): Promise<TableIdMap> {
  console.log("Building RuleTable ID map...")
  const map: TableIdMap = new Map()

  // 1) Read all RuleTables from core
  const coreTables = await db.ruleTable.findMany({
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { key: "asc" },
  })

  console.log(`  Found ${coreTables.length} RuleTables in core.`)

  if (dryRun) {
    // In dry run, just map id -> id (no actual upsert)
    for (const t of coreTables) {
      map.set(t.id, t.id)
      console.log(`  [DRY RUN] Would upsert: key="${t.key}", name="${t.name}"`)
    }
    return map
  }

  // 2) Upsert into regulatory by natural key, capture resulting ID
  for (const t of coreTables) {
    const reg = await dbReg.ruleTable.upsert({
      where: { key: t.key },
      update: {
        // Update non-critical fields deterministically
        name: t.name,
        description: t.description,
        // Do NOT overwrite createdAt/updatedAt; those are managed fields
      },
      create: {
        // Important: do NOT force id, let regulatory generate its own if it doesn't exist
        key: t.key,
        name: t.name,
        description: t.description,
        // createdAt/updatedAt auto-managed
      },
      select: { id: true, key: true },
    })

    map.set(t.id, reg.id)

    if (t.id !== reg.id) {
      console.log(`  Mapped: ${t.key} (core=${t.id} -> reg=${reg.id})`)
    }
  }

  console.log(`  Built map with ${map.size} entries.\n`)

  // Verify: every core table is mapped
  if (map.size !== coreTables.length) {
    throw new Error(
      `Map size mismatch: expected ${coreTables.length}, got ${map.size}. ` +
        "This should not happen."
    )
  }

  return map
}

async function copyRuleVersions(
  tableIdMap: TableIdMap
): Promise<{ inserted: number; skipped: number }> {
  console.log("Copying RuleVersions...")

  const coreVersions = await db.ruleVersion.findMany({
    select: {
      id: true,
      tableId: true,
      version: true,
      effectiveFrom: true,
      effectiveUntil: true,
      data: true,
      dataHash: true,
      publishedAt: true,
      createdAt: true,
    },
    orderBy: [{ tableId: "asc" }, { version: "asc" }],
  })

  console.log(`  Found ${coreVersions.length} RuleVersions in core.`)

  if (coreVersions.length === 0) {
    return { inserted: 0, skipped: 0 }
  }

  // Rewrite tableIds
  const rewritten = coreVersions.map((v) => {
    const mappedTableId = tableIdMap.get(v.tableId)
    if (!mappedTableId) {
      throw new Error(
        `Missing tableId mapping for core RuleTable.id=${v.tableId}. Did RuleTable copy run?`
      )
    }

    return {
      id: v.id, // Keep original ID
      tableId: mappedTableId, // Rewrite to regulatory tableId
      version: v.version,
      effectiveFrom: v.effectiveFrom,
      effectiveUntil: v.effectiveUntil,
      data: v.data,
      dataHash: v.dataHash,
      publishedAt: v.publishedAt,
      createdAt: v.createdAt,
    }
  })

  if (dryRun) {
    console.log(`  [DRY RUN] Would insert ${rewritten.length} RuleVersions.`)
    return { inserted: rewritten.length, skipped: 0 }
  }

  // Insert in chunks
  let inserted = 0
  let skipped = 0

  for (let i = 0; i < rewritten.length; i += CHUNK_SIZE) {
    const chunk = rewritten.slice(i, i + CHUNK_SIZE)
    const result = await dbReg.ruleVersion.createMany({
      data: chunk as unknown as PrismaReg.RuleVersionCreateManyInput[],
      skipDuplicates: true,
    })
    inserted += result.count
    skipped += chunk.length - result.count

    console.log(
      `  Chunk ${Math.floor(i / CHUNK_SIZE) + 1}: ` +
        `inserted ${result.count}, skipped ${chunk.length - result.count}`
    )
  }

  console.log(`  Total: inserted ${inserted}, skipped ${skipped}.\n`)
  return { inserted, skipped }
}

async function copyRuleSnapshots(): Promise<{ inserted: number; skipped: number }> {
  console.log("Copying RuleSnapshots...")

  const coreSnapshots = await db.ruleSnapshot.findMany({
    select: {
      id: true,
      ruleVersionId: true,
      data: true,
      dataHash: true,
      createdAt: true,
    },
    orderBy: { ruleVersionId: "asc" },
  })

  console.log(`  Found ${coreSnapshots.length} RuleSnapshots in core.`)

  if (coreSnapshots.length === 0) {
    return { inserted: 0, skipped: 0 }
  }

  if (dryRun) {
    console.log(`  [DRY RUN] Would insert ${coreSnapshots.length} RuleSnapshots.`)
    return { inserted: coreSnapshots.length, skipped: 0 }
  }

  // Copy verbatim (IDs are stable, ruleVersionId FK references stable IDs)
  let inserted = 0
  let skipped = 0

  for (let i = 0; i < coreSnapshots.length; i += CHUNK_SIZE) {
    const chunk = coreSnapshots.slice(i, i + CHUNK_SIZE)
    const result = await dbReg.ruleSnapshot.createMany({
      data: chunk as unknown as PrismaReg.RuleSnapshotCreateManyInput[],
      skipDuplicates: true,
    })
    inserted += result.count
    skipped += chunk.length - result.count

    console.log(
      `  Chunk ${Math.floor(i / CHUNK_SIZE) + 1}: ` +
        `inserted ${result.count}, skipped ${chunk.length - result.count}`
    )
  }

  console.log(`  Total: inserted ${inserted}, skipped ${skipped}.\n`)
  return { inserted, skipped }
}

async function copyRuleCalculations(): Promise<{ inserted: number; skipped: number }> {
  console.log("Copying RuleCalculations...")

  // RuleCalculations can be large - get count first
  const count = await db.ruleCalculation.count()
  console.log(`  Found ${count} RuleCalculations in core.`)

  if (count === 0) {
    return { inserted: 0, skipped: 0 }
  }

  if (dryRun) {
    console.log(`  [DRY RUN] Would insert ${count} RuleCalculations.`)
    return { inserted: count, skipped: 0 }
  }

  // Copy in chunks using cursor-based pagination for large datasets
  let inserted = 0
  let skipped = 0
  let cursor: string | undefined
  let chunkNum = 0

  while (true) {
    const chunk = await db.ruleCalculation.findMany({
      take: CHUNK_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      select: {
        id: true,
        ruleVersionId: true,
        tableKey: true,
        input: true,
        result: true,
        referenceDate: true,
        createdAt: true,
      },
      orderBy: { id: "asc" },
    })

    if (chunk.length === 0) break

    cursor = chunk[chunk.length - 1].id
    chunkNum++

    const result = await dbReg.ruleCalculation.createMany({
      data: chunk as unknown as PrismaReg.RuleCalculationCreateManyInput[],
      skipDuplicates: true,
    })

    inserted += result.count
    skipped += chunk.length - result.count

    if (chunkNum % 10 === 0) {
      console.log(
        `  Progress: ${inserted + skipped}/${count} ` + `(inserted ${inserted}, skipped ${skipped})`
      )
    }
  }

  console.log(`  Total: inserted ${inserted}, skipped ${skipped}.\n`)
  return { inserted, skipped }
}

async function main(): Promise<void> {
  const startTime = Date.now()

  const stats: CopyStats = {
    ruleTables: { scanned: 0, inserted: 0, skipped: 0 },
    ruleVersions: { scanned: 0, inserted: 0, skipped: 0 },
    ruleSnapshots: { scanned: 0, inserted: 0, skipped: 0 },
    ruleCalculations: { scanned: 0, inserted: 0, skipped: 0 },
    duration: 0,
  }

  try {
    // Preflight checks
    const preflightOk = await preflightChecks()
    if (!preflightOk) {
      process.exit(1)
    }

    // Step 1: Build tableIdMap from RuleTables
    const tableIdMap = await buildRuleTableIdMap()
    stats.ruleTables.scanned = tableIdMap.size
    stats.ruleTables.inserted = dryRun ? 0 : tableIdMap.size // All upserted

    // Step 2: Copy RuleVersions with tableId rewrite
    stats.ruleVersions.scanned = await db.ruleVersion.count()
    const versionResult = await copyRuleVersions(tableIdMap)
    stats.ruleVersions.inserted = versionResult.inserted
    stats.ruleVersions.skipped = versionResult.skipped

    // Step 3: Copy RuleSnapshots (verbatim)
    stats.ruleSnapshots.scanned = await db.ruleSnapshot.count()
    const snapshotResult = await copyRuleSnapshots()
    stats.ruleSnapshots.inserted = snapshotResult.inserted
    stats.ruleSnapshots.skipped = snapshotResult.skipped

    // Step 4: Copy RuleCalculations (verbatim)
    stats.ruleCalculations.scanned = await db.ruleCalculation.count()
    const calcResult = await copyRuleCalculations()
    stats.ruleCalculations.inserted = calcResult.inserted
    stats.ruleCalculations.skipped = calcResult.skipped

    stats.duration = (Date.now() - startTime) / 1000

    // Summary
    console.log("=== Copy Complete ===\n")
    console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`)
    console.log(`Duration: ${stats.duration.toFixed(2)}s\n`)
    console.log("| Table            | Scanned | Inserted | Skipped |")
    console.log("|------------------|---------|----------|---------|")
    console.log(
      `| RuleTable        | ${stats.ruleTables.scanned.toString().padStart(7)} | ${stats.ruleTables.inserted.toString().padStart(8)} | ${stats.ruleTables.skipped.toString().padStart(7)} |`
    )
    console.log(
      `| RuleVersion      | ${stats.ruleVersions.scanned.toString().padStart(7)} | ${stats.ruleVersions.inserted.toString().padStart(8)} | ${stats.ruleVersions.skipped.toString().padStart(7)} |`
    )
    console.log(
      `| RuleSnapshot     | ${stats.ruleSnapshots.scanned.toString().padStart(7)} | ${stats.ruleSnapshots.inserted.toString().padStart(8)} | ${stats.ruleSnapshots.skipped.toString().padStart(7)} |`
    )
    console.log(
      `| RuleCalculation  | ${stats.ruleCalculations.scanned.toString().padStart(7)} | ${stats.ruleCalculations.inserted.toString().padStart(8)} | ${stats.ruleCalculations.skipped.toString().padStart(7)} |`
    )
    console.log()

    if (dryRun) {
      console.log("DRY RUN complete. No data was modified.")
      console.log("Run without --dry-run to perform the actual copy.\n")
    } else {
      console.log("Copy complete. Run verify-ruleversion-parity.ts to verify parity.\n")
    }

    process.exit(0)
  } catch (error) {
    console.error("\nERROR during copy:", error)
    process.exit(1)
  }
}

void main()
