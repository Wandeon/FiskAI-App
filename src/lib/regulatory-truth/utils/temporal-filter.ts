// src/lib/regulatory-truth/utils/temporal-filter.ts
/**
 * Temporal Filtering Utility
 *
 * Provides consistent date boundary logic for filtering regulatory rules:
 * - effectiveFrom is INCLUSIVE (effectiveFrom <= queryDate)
 * - effectiveUntil is EXCLUSIVE (effectiveUntil > queryDate OR effectiveUntil IS NULL)
 *
 * This ensures:
 * 1. A rule is effective starting from its effectiveFrom date
 * 2. A rule is NO LONGER effective on its effectiveUntil date
 * 3. Rules with null effectiveUntil never expire
 */

import type { Prisma } from "@prisma/client"

export interface TemporallyBoundedEntity {
  effectiveFrom: Date
  effectiveUntil: Date | null
}

export type TemporalFilterReason = "VALID" | "FUTURE" | "EXPIRED"

export interface TemporalFilterResult {
  isEffective: boolean
  reason: TemporalFilterReason
}

/**
 * Check if an entity is temporally effective at the given date.
 *
 * Boundary semantics:
 * - effectiveFrom is INCLUSIVE: rule is effective ON the effectiveFrom date
 * - effectiveUntil is EXCLUSIVE: rule is NOT effective ON the effectiveUntil date
 *
 * @example
 * // Rule effective 2025-01-01 to 2025-12-31
 * isTemporallyEffective({ effectiveFrom: new Date('2025-01-01'), effectiveUntil: new Date('2025-12-31') }, new Date('2025-01-01'))
 * // Returns: { isEffective: true, reason: 'VALID' }
 *
 * isTemporallyEffective({ effectiveFrom: new Date('2025-01-01'), effectiveUntil: new Date('2025-12-31') }, new Date('2025-12-31'))
 * // Returns: { isEffective: false, reason: 'EXPIRED' } (effectiveUntil is exclusive)
 */
export function isTemporallyEffective(
  entity: TemporallyBoundedEntity,
  asOfDate: Date
): TemporalFilterResult {
  // Normalize dates to start of day for consistent comparison
  const queryDate = normalizeToStartOfDay(asOfDate)
  const fromDate = normalizeToStartOfDay(entity.effectiveFrom)
  const untilDate = entity.effectiveUntil ? normalizeToStartOfDay(entity.effectiveUntil) : null

  // Rule must have started (effectiveFrom <= queryDate, i.e., fromDate is inclusive)
  if (fromDate > queryDate) {
    return { isEffective: false, reason: "FUTURE" }
  }

  // Rule must not have expired (effectiveUntil > queryDate, i.e., untilDate is exclusive)
  // null effectiveUntil means no expiry
  if (untilDate !== null && untilDate <= queryDate) {
    return { isEffective: false, reason: "EXPIRED" }
  }

  return { isEffective: true, reason: "VALID" }
}

/**
 * Normalize a date to the start of day (00:00:00.000) in UTC.
 * This ensures consistent date comparisons regardless of time components.
 */
export function normalizeToStartOfDay(date: Date): Date {
  const normalized = new Date(date)
  normalized.setUTCHours(0, 0, 0, 0)
  return normalized
}

/**
 * Filter an array of temporally bounded entities to only those effective at the given date.
 *
 * @example
 * const rules = [
 *   { id: '1', effectiveFrom: new Date('2024-01-01'), effectiveUntil: new Date('2024-12-31') },
 *   { id: '2', effectiveFrom: new Date('2025-01-01'), effectiveUntil: null },
 *   { id: '3', effectiveFrom: new Date('2026-01-01'), effectiveUntil: null },
 * ]
 * filterByTemporalEffectiveness(rules, new Date('2025-06-15'))
 * // Returns: [{ id: '2', ... }]
 */
export function filterByTemporalEffectiveness<T extends TemporallyBoundedEntity>(
  entities: T[],
  asOfDate: Date
): T[] {
  return entities.filter((entity) => isTemporallyEffective(entity, asOfDate).isEffective)
}

/**
 * Partition entities into effective and non-effective groups.
 * Useful for debugging and tracking which rules were excluded and why.
 */
export function partitionByTemporalEffectiveness<T extends TemporallyBoundedEntity>(
  entities: T[],
  asOfDate: Date
): {
  effective: T[]
  expired: T[]
  future: T[]
} {
  const effective: T[] = []
  const expired: T[] = []
  const future: T[] = []

  for (const entity of entities) {
    const result = isTemporallyEffective(entity, asOfDate)
    switch (result.reason) {
      case "VALID":
        effective.push(entity)
        break
      case "EXPIRED":
        expired.push(entity)
        break
      case "FUTURE":
        future.push(entity)
        break
    }
  }

  return { effective, expired, future }
}

/**
 * Build a Prisma where clause for temporal filtering.
 *
 * This generates the SQL equivalent of:
 * WHERE effectiveFrom <= :asOfDate AND (effectiveUntil IS NULL OR effectiveUntil > :asOfDate)
 *
 * @example
 * const whereClause = buildTemporalWhereClause(new Date('2025-06-15'))
 * // Returns: { effectiveFrom: { lte: ... }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: ... } }] }
 */
export function buildTemporalWhereClause(asOfDate: Date): Prisma.RegulatoryRuleWhereInput {
  const queryDate = normalizeToStartOfDay(asOfDate)

  return {
    effectiveFrom: { lte: queryDate },
    OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: queryDate } }],
  }
}

/**
 * Merge temporal filtering with existing where conditions.
 * Use this when you need to combine temporal filtering with other query conditions.
 *
 * @example
 * const existingWhere = { status: 'PUBLISHED', conceptSlug: 'vat-rate' }
 * const merged = mergeTemporalFilter(existingWhere, new Date('2025-06-15'))
 */
export function mergeTemporalFilter(
  existingWhere: Prisma.RegulatoryRuleWhereInput,
  asOfDate: Date
): Prisma.RegulatoryRuleWhereInput {
  const temporalFilter = buildTemporalWhereClause(asOfDate)

  // If existingWhere has an OR clause, we need to wrap it in AND
  if (existingWhere.OR) {
    const { OR: existingOR, ...restExisting } = existingWhere
    return {
      AND: [{ OR: existingOR }, restExisting, temporalFilter],
    }
  }

  return {
    ...existingWhere,
    ...temporalFilter,
    // Handle the OR clause from temporal filter
    OR: temporalFilter.OR,
  }
}

/**
 * Get the current effective date for queries.
 * Returns the start of today in UTC.
 */
export function getCurrentEffectiveDate(): Date {
  return normalizeToStartOfDay(new Date())
}
