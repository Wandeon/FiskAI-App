#!/usr/bin/env npx tsx
/**
 * Verify RuleVersion Bundle Parity Between Core and Regulatory DBs
 *
 * PR#10: Deterministic parity verification for regulated logic tables.
 *
 * Checks:
 * 1. Counts per table must match
 * 2. RuleVersion: compare (ruleTable.key, version, dataHash, effectiveFrom, effectiveUntil) sets
 * 3. RuleSnapshot/RuleCalculation: compare counts by ruleVersionId
 *
 * Usage:
 *   npx tsx scripts/verify-ruleversion-parity.ts
 *
 * Exit codes:
 *   0 = parity verified
 *   1 = parity mismatch detected
 */

import { db } from "../src/lib/db"
import { dbReg } from "../src/lib/db/regulatory"

interface ParityResult {
  table: string
  passed: boolean
  coreCount: number
  regCount: number
  details?: string
}

const results: ParityResult[] = []

console.log("\n=== RuleVersion Bundle Parity Verification ===\n")

async function verifyRuleTableParity(): Promise<boolean> {
  console.log("1. Verifying RuleTable parity...")

  const coreTables = await db.ruleTable.findMany({
    select: { key: true, name: true },
    orderBy: { key: "asc" },
  })

  const regTables = await dbReg.ruleTable.findMany({
    select: { key: true, name: true },
    orderBy: { key: "asc" },
  })

  const coreCount = coreTables.length
  const regCount = regTables.length

  console.log(`   Core: ${coreCount} RuleTables`)
  console.log(`   Regulatory: ${regCount} RuleTables`)

  if (coreCount !== regCount) {
    results.push({
      table: "RuleTable",
      passed: false,
      coreCount,
      regCount,
      details: `Count mismatch: core=${coreCount}, reg=${regCount}`,
    })
    console.log(`   FAIL: Count mismatch\n`)
    return false
  }

  // Compare keys
  const coreKeys = new Set(coreTables.map((t) => t.key))
  const regKeys = new Set(regTables.map((t) => t.key))

  const missingInReg = [...coreKeys].filter((k) => !regKeys.has(k))
  const extraInReg = [...regKeys].filter((k) => !coreKeys.has(k))

  if (missingInReg.length > 0 || extraInReg.length > 0) {
    const details = []
    if (missingInReg.length > 0) details.push(`Missing in reg: ${missingInReg.join(", ")}`)
    if (extraInReg.length > 0) details.push(`Extra in reg: ${extraInReg.join(", ")}`)

    results.push({
      table: "RuleTable",
      passed: false,
      coreCount,
      regCount,
      details: details.join("; "),
    })
    console.log(`   FAIL: Key mismatch - ${details.join("; ")}\n`)
    return false
  }

  results.push({ table: "RuleTable", passed: true, coreCount, regCount })
  console.log(`   PASS: All ${coreCount} RuleTables match by key\n`)
  return true
}

async function verifyRuleVersionParity(): Promise<boolean> {
  console.log("2. Verifying RuleVersion parity...")

  // Get all RuleVersions with their table keys
  const coreVersions = await db.ruleVersion.findMany({
    select: {
      version: true,
      dataHash: true,
      effectiveFrom: true,
      effectiveUntil: true,
      table: { select: { key: true } },
    },
    orderBy: [{ table: { key: "asc" } }, { version: "asc" }],
  })

  const regVersions = await dbReg.ruleVersion.findMany({
    select: {
      version: true,
      dataHash: true,
      effectiveFrom: true,
      effectiveUntil: true,
      table: { select: { key: true } },
    },
    orderBy: [{ table: { key: "asc" } }, { version: "asc" }],
  })

  const coreCount = coreVersions.length
  const regCount = regVersions.length

  console.log(`   Core: ${coreCount} RuleVersions`)
  console.log(`   Regulatory: ${regCount} RuleVersions`)

  if (coreCount !== regCount) {
    results.push({
      table: "RuleVersion",
      passed: false,
      coreCount,
      regCount,
      details: `Count mismatch: core=${coreCount}, reg=${regCount}`,
    })
    console.log(`   FAIL: Count mismatch\n`)
    return false
  }

  // Build composite keys for comparison: (tableKey, version, dataHash, effectiveFrom, effectiveUntil)
  function makeKey(v: {
    version: string
    dataHash: string
    effectiveFrom: Date
    effectiveUntil: Date | null
    table: { key: string }
  }): string {
    return [
      v.table.key,
      v.version,
      v.dataHash,
      v.effectiveFrom.toISOString(),
      v.effectiveUntil?.toISOString() ?? "null",
    ].join("|")
  }

  const coreKeySet = new Set(coreVersions.map(makeKey))
  const regKeySet = new Set(regVersions.map(makeKey))

  const missingInReg: string[] = []
  const extraInReg: string[] = []

  for (const k of coreKeySet) {
    if (!regKeySet.has(k)) {
      missingInReg.push(k)
    }
  }

  for (const k of regKeySet) {
    if (!coreKeySet.has(k)) {
      extraInReg.push(k)
    }
  }

  if (missingInReg.length > 0 || extraInReg.length > 0) {
    const details = []
    if (missingInReg.length > 0) {
      details.push(`Missing in reg (first 3): ${missingInReg.slice(0, 3).join("; ")}`)
    }
    if (extraInReg.length > 0) {
      details.push(`Extra in reg (first 3): ${extraInReg.slice(0, 3).join("; ")}`)
    }

    results.push({
      table: "RuleVersion",
      passed: false,
      coreCount,
      regCount,
      details: details.join(" | "),
    })
    console.log(`   FAIL: ${missingInReg.length} missing, ${extraInReg.length} extra\n`)
    return false
  }

  results.push({ table: "RuleVersion", passed: true, coreCount, regCount })
  console.log(`   PASS: All ${coreCount} RuleVersions match by composite key\n`)
  return true
}

async function verifyRuleSnapshotParity(): Promise<boolean> {
  console.log("3. Verifying RuleSnapshot parity...")

  // Count by ruleVersionId
  const coreSnapshots = await db.ruleSnapshot.groupBy({
    by: ["ruleVersionId"],
    _count: { id: true },
    orderBy: { ruleVersionId: "asc" },
  })

  const regSnapshots = await dbReg.ruleSnapshot.groupBy({
    by: ["ruleVersionId"],
    _count: { id: true },
    orderBy: { ruleVersionId: "asc" },
  })

  const coreTotal = await db.ruleSnapshot.count()
  const regTotal = await dbReg.ruleSnapshot.count()

  console.log(`   Core: ${coreTotal} RuleSnapshots across ${coreSnapshots.length} versions`)
  console.log(`   Regulatory: ${regTotal} RuleSnapshots across ${regSnapshots.length} versions`)

  if (coreTotal !== regTotal) {
    results.push({
      table: "RuleSnapshot",
      passed: false,
      coreCount: coreTotal,
      regCount: regTotal,
      details: `Count mismatch: core=${coreTotal}, reg=${regTotal}`,
    })
    console.log(`   FAIL: Count mismatch\n`)
    return false
  }

  // Compare counts per ruleVersionId
  const coreMap = new Map(coreSnapshots.map((s) => [s.ruleVersionId, s._count.id]))
  const regMap = new Map(regSnapshots.map((s) => [s.ruleVersionId, s._count.id]))

  const mismatches: string[] = []

  for (const [versionId, coreCount] of coreMap) {
    const regCount = regMap.get(versionId) ?? 0
    if (coreCount !== regCount) {
      mismatches.push(`${versionId}: core=${coreCount}, reg=${regCount}`)
    }
  }

  for (const [versionId] of regMap) {
    if (!coreMap.has(versionId)) {
      mismatches.push(`${versionId}: missing in core`)
    }
  }

  if (mismatches.length > 0) {
    results.push({
      table: "RuleSnapshot",
      passed: false,
      coreCount: coreTotal,
      regCount: regTotal,
      details: `${mismatches.length} version(s) with count mismatch`,
    })
    console.log(`   FAIL: ${mismatches.length} version(s) with count mismatch\n`)
    if (mismatches.length <= 5) {
      mismatches.forEach((m) => console.log(`     - ${m}`))
    }
    return false
  }

  results.push({ table: "RuleSnapshot", passed: true, coreCount: coreTotal, regCount: regTotal })
  console.log(`   PASS: All ${coreTotal} RuleSnapshots match by ruleVersionId counts\n`)
  return true
}

async function verifyRuleCalculationParity(): Promise<boolean> {
  console.log("4. Verifying RuleCalculation parity...")

  const coreTotal = await db.ruleCalculation.count()
  const regTotal = await dbReg.ruleCalculation.count()

  console.log(`   Core: ${coreTotal} RuleCalculations`)
  console.log(`   Regulatory: ${regTotal} RuleCalculations`)

  if (coreTotal !== regTotal) {
    results.push({
      table: "RuleCalculation",
      passed: false,
      coreCount: coreTotal,
      regCount: regTotal,
      details: `Count mismatch: core=${coreTotal}, reg=${regTotal}`,
    })
    console.log(`   FAIL: Count mismatch\n`)
    return false
  }

  // For large tables, verify counts by ruleVersionId
  if (coreTotal > 0) {
    const coreByVersion = await db.ruleCalculation.groupBy({
      by: ["ruleVersionId"],
      _count: { id: true },
      orderBy: { ruleVersionId: "asc" },
    })

    const regByVersion = await dbReg.ruleCalculation.groupBy({
      by: ["ruleVersionId"],
      _count: { id: true },
      orderBy: { ruleVersionId: "asc" },
    })

    const coreMap = new Map(coreByVersion.map((c) => [c.ruleVersionId, c._count.id]))
    const regMap = new Map(regByVersion.map((c) => [c.ruleVersionId, c._count.id]))

    let mismatchCount = 0

    for (const [versionId, coreCount] of coreMap) {
      const regCount = regMap.get(versionId) ?? 0
      if (coreCount !== regCount) {
        mismatchCount++
      }
    }

    for (const [versionId] of regMap) {
      if (!coreMap.has(versionId)) {
        mismatchCount++
      }
    }

    if (mismatchCount > 0) {
      results.push({
        table: "RuleCalculation",
        passed: false,
        coreCount: coreTotal,
        regCount: regTotal,
        details: `${mismatchCount} version(s) with count mismatch`,
      })
      console.log(`   FAIL: ${mismatchCount} version(s) with count mismatch\n`)
      return false
    }
  }

  results.push({
    table: "RuleCalculation",
    passed: true,
    coreCount: coreTotal,
    regCount: regTotal,
  })
  console.log(`   PASS: All ${coreTotal} RuleCalculations match by ruleVersionId counts\n`)
  return true
}

async function main(): Promise<void> {
  try {
    // Run all verifications
    const ruleTableOk = await verifyRuleTableParity()
    const ruleVersionOk = await verifyRuleVersionParity()
    const ruleSnapshotOk = await verifyRuleSnapshotParity()
    const ruleCalculationOk = await verifyRuleCalculationParity()

    // Summary
    console.log("=== Parity Verification Summary ===\n")
    console.log("| Table            | Status | Core Count | Reg Count |")
    console.log("|------------------|--------|------------|-----------|")

    for (const r of results) {
      console.log(
        `| ${r.table.padEnd(16)} | ${r.passed ? "PASS  " : "FAIL  "} | ${r.coreCount.toString().padStart(10)} | ${r.regCount.toString().padStart(9)} |`
      )
    }

    console.log()

    const allPassed = ruleTableOk && ruleVersionOk && ruleSnapshotOk && ruleCalculationOk

    if (allPassed) {
      console.log("All parity checks PASSED.\n")
      console.log("It is now safe to:")
      console.log("  1. Set RULE_VERSION_SOURCE=dual for parity testing in staging")
      console.log("  2. Monitor logs for mismatches")
      console.log("  3. After stability, set RULE_VERSION_SOURCE=regulatory\n")
      process.exit(0)
    } else {
      console.log("Some parity checks FAILED.\n")

      for (const r of results) {
        if (!r.passed && r.details) {
          console.log(`${r.table}: ${r.details}`)
        }
      }

      console.log("\nDo NOT flip to regulatory until parity is verified.\n")
      process.exit(1)
    }
  } catch (error) {
    console.error("\nERROR during parity verification:", error)
    process.exit(1)
  }
}

void main()
