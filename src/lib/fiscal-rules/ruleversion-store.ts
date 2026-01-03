// src/lib/fiscal-rules/ruleversion-store.ts
/**
 * RuleVersion Store - Compatibility Layer for RuleVersion Migration
 *
 * PR#10: Abstracts RuleVersion reads to support migration from core to regulatory DB.
 *
 * Modes:
 * - "core": Read from core DB (db.ruleVersion) - default before migration
 * - "regulatory": Read from regulatory DB (dbReg.ruleVersion) - after migration verified
 * - "dual": Read from both, compare hashes, log mismatches, return core - for parity testing
 *
 * Usage:
 * - All code should use this store for RuleVersion/RuleTable reads
 * - Writes still go to core until full cutover (separate concern)
 * - Set RULE_VERSION_SOURCE env var to control source
 */

import { db, dbReg } from "@/lib/db"
import type { RuleTableKey } from "./types"

// Source configuration
type RuleVersionSource = "core" | "regulatory" | "dual"

function getSource(): RuleVersionSource {
  const envSource = process.env.RULE_VERSION_SOURCE?.toLowerCase()
  if (envSource === "regulatory" || envSource === "dual") {
    return envSource
  }
  return "core"
}

// Type for RuleVersion with optional table include
interface RuleVersionRecord {
  id: string
  tableId: string
  version: string
  effectiveFrom: Date
  effectiveUntil: Date | null
  data: unknown
  dataHash: string
  publishedAt: Date
  createdAt: Date
}

interface RuleVersionWithTable extends RuleVersionRecord {
  table: {
    id: string
    key: string
    name: string
    description: string | null
  }
}

interface RuleTableRecord {
  id: string
  key: string
  name: string
  description: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Log parity mismatch in dual mode.
 * Includes enough context to debug without being overwhelming.
 */
function logParityMismatch(
  entity: string,
  id: string,
  field: string,
  coreValue: unknown,
  regValue: unknown
) {
  console.warn(`[RuleVersionStore] PARITY MISMATCH: ${entity} id=${id} field=${field}`, {
    core: coreValue,
    regulatory: regValue,
  })
}

/**
 * Get RuleTable by natural key.
 */
export async function getRuleTableByKey(key: string): Promise<RuleTableRecord | null> {
  const source = getSource()

  if (source === "core") {
    return db.ruleTable.findUnique({ where: { key } })
  }

  if (source === "regulatory") {
    return dbReg.ruleTable.findUnique({ where: { key } })
  }

  // Dual mode: read from both, compare, return core
  const [core, reg] = await Promise.all([
    db.ruleTable.findUnique({ where: { key } }),
    dbReg.ruleTable.findUnique({ where: { key } }),
  ])

  if (core && reg) {
    // Compare key fields (name, description)
    if (core.name !== reg.name) {
      logParityMismatch("RuleTable", key, "name", core.name, reg.name)
    }
    if (core.description !== reg.description) {
      logParityMismatch("RuleTable", key, "description", core.description, reg.description)
    }
  } else if (core && !reg) {
    console.warn(`[RuleVersionStore] RuleTable key=${key} exists in core but not regulatory`)
  } else if (!core && reg) {
    console.warn(`[RuleVersionStore] RuleTable key=${key} exists in regulatory but not core`)
  }

  return core
}

/**
 * Get RuleVersion by ID.
 */
export async function getRuleVersionById(id: string): Promise<RuleVersionRecord | null> {
  const source = getSource()

  if (source === "core") {
    return db.ruleVersion.findUnique({ where: { id } })
  }

  if (source === "regulatory") {
    return dbReg.ruleVersion.findUnique({ where: { id } })
  }

  // Dual mode
  const [core, reg] = await Promise.all([
    db.ruleVersion.findUnique({ where: { id } }),
    dbReg.ruleVersion.findUnique({ where: { id } }),
  ])

  if (core && reg) {
    // Compare critical fields
    if (core.dataHash !== reg.dataHash) {
      logParityMismatch("RuleVersion", id, "dataHash", core.dataHash, reg.dataHash)
    }
    if (core.effectiveFrom.getTime() !== reg.effectiveFrom.getTime()) {
      logParityMismatch("RuleVersion", id, "effectiveFrom", core.effectiveFrom, reg.effectiveFrom)
    }
    if ((core.effectiveUntil?.getTime() ?? null) !== (reg.effectiveUntil?.getTime() ?? null)) {
      logParityMismatch(
        "RuleVersion",
        id,
        "effectiveUntil",
        core.effectiveUntil,
        reg.effectiveUntil
      )
    }
  } else if (core && !reg) {
    console.warn(`[RuleVersionStore] RuleVersion id=${id} exists in core but not regulatory`)
  } else if (!core && reg) {
    console.warn(`[RuleVersionStore] RuleVersion id=${id} exists in regulatory but not core`)
  }

  return core
}

/**
 * Get RuleVersion by ID with table included.
 */
export async function getRuleVersionByIdWithTable(
  id: string
): Promise<RuleVersionWithTable | null> {
  const source = getSource()

  if (source === "core") {
    return db.ruleVersion.findUnique({
      where: { id },
      include: { table: true },
    })
  }

  if (source === "regulatory") {
    return dbReg.ruleVersion.findUnique({
      where: { id },
      include: { table: true },
    })
  }

  // Dual mode
  const [core, reg] = await Promise.all([
    db.ruleVersion.findUnique({ where: { id }, include: { table: true } }),
    dbReg.ruleVersion.findUnique({ where: { id }, include: { table: true } }),
  ])

  if (core && reg) {
    if (core.dataHash !== reg.dataHash) {
      logParityMismatch("RuleVersion", id, "dataHash", core.dataHash, reg.dataHash)
    }
    if (core.table.key !== reg.table.key) {
      logParityMismatch("RuleVersion", id, "table.key", core.table.key, reg.table.key)
    }
  } else if (core && !reg) {
    console.warn(`[RuleVersionStore] RuleVersion id=${id} exists in core but not regulatory`)
  } else if (!core && reg) {
    console.warn(`[RuleVersionStore] RuleVersion id=${id} exists in regulatory but not core`)
  }

  return core
}

/**
 * Get effective RuleVersion for a table key and reference date.
 * Returns the most recent version that is effective on the given date.
 */
export async function getEffectiveRuleVersion(
  tableKey: RuleTableKey,
  referenceDate: Date
): Promise<RuleVersionRecord | null> {
  const source = getSource()

  const whereClause = {
    table: { key: tableKey },
    effectiveFrom: { lte: referenceDate },
    OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: referenceDate } }],
  }

  const orderBy = { effectiveFrom: "desc" as const }

  if (source === "core") {
    return db.ruleVersion.findFirst({ where: whereClause, orderBy })
  }

  if (source === "regulatory") {
    return dbReg.ruleVersion.findFirst({ where: whereClause, orderBy })
  }

  // Dual mode
  const [core, reg] = await Promise.all([
    db.ruleVersion.findFirst({ where: whereClause, orderBy }),
    dbReg.ruleVersion.findFirst({ where: whereClause, orderBy }),
  ])

  if (core && reg) {
    // For effective queries, compare which version was selected
    if (core.id !== reg.id) {
      logParityMismatch(
        "RuleVersion",
        `effective:${tableKey}:${referenceDate.toISOString()}`,
        "selectedId",
        core.id,
        reg.id
      )
    }
    if (core.dataHash !== reg.dataHash) {
      logParityMismatch("RuleVersion", core.id, "dataHash", core.dataHash, reg.dataHash)
    }
  } else if (core && !reg) {
    console.warn(
      `[RuleVersionStore] Effective RuleVersion for ${tableKey}@${referenceDate.toISOString()} ` +
        `exists in core (id=${core.id}) but not regulatory`
    )
  } else if (!core && reg) {
    console.warn(
      `[RuleVersionStore] Effective RuleVersion for ${tableKey}@${referenceDate.toISOString()} ` +
        `exists in regulatory (id=${reg.id}) but not core`
    )
  }

  return core
}

/**
 * Get current source mode for debugging/logging.
 */
export function getCurrentSource(): RuleVersionSource {
  return getSource()
}
