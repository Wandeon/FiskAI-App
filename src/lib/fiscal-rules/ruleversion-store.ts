// src/lib/fiscal-rules/ruleversion-store.ts
/**
 * RuleVersion Store - Regulatory DB Access Layer
 *
 * Single source of truth for RuleVersion/RuleTable reads.
 * All reads come from the regulatory schema (dbReg).
 *
 * History:
 * - PR#10: Original dual-mode abstraction for migration
 * - PR#1306: Migration complete, dual-mode removed
 *
 * Usage:
 * - All code should use this store for RuleVersion/RuleTable reads
 * - Writes also go to regulatory DB (see service.ts)
 */

import { dbReg } from "@/lib/db"
import type { RuleTableKey } from "./types"

// =============================================================================
// TYPES
// =============================================================================

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

// =============================================================================
// STORE FUNCTIONS
// =============================================================================

/**
 * Get RuleTable by natural key.
 */
export async function getRuleTableByKey(key: string): Promise<RuleTableRecord | null> {
  return dbReg.ruleTable.findUnique({ where: { key } })
}

/**
 * Get RuleVersion by ID.
 */
export async function getRuleVersionById(id: string): Promise<RuleVersionRecord | null> {
  return dbReg.ruleVersion.findUnique({ where: { id } })
}

/**
 * Get RuleVersion by ID with table included.
 */
export async function getRuleVersionByIdWithTable(
  id: string
): Promise<RuleVersionWithTable | null> {
  return dbReg.ruleVersion.findUnique({
    where: { id },
    include: { table: true },
  })
}

/**
 * Get effective RuleVersion for a table key and reference date.
 * Returns the most recent version that is effective on the given date.
 */
export async function getEffectiveRuleVersion(
  tableKey: RuleTableKey,
  referenceDate: Date
): Promise<RuleVersionRecord | null> {
  return dbReg.ruleVersion.findFirst({
    where: {
      table: { key: tableKey },
      effectiveFrom: { lte: referenceDate },
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: referenceDate } }],
    },
    orderBy: { effectiveFrom: "desc" },
  })
}
