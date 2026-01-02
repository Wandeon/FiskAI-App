/**
 * Period Lock Guard
 *
 * Unified enforcement of accounting period locks across all period-affecting entities.
 * This module provides the `assertPeriodWritable()` guard that must be called
 * before any CREATE, UPDATE, or DELETE operation on period-affecting entities.
 *
 * @module period-locking
 * @since PHASE 2 - Enterprise Hardening
 */

import type { PrismaClient, PeriodStatus } from "@prisma/client"
import {
  PERIOD_AFFECTING_ENTITIES_BY_MODEL,
  LOCKED_PERIOD_STATUSES,
  type PeriodAffectingEntity,
} from "./period-affecting-entities"
import { getTenantContext } from "../prisma-extensions"

/**
 * Error thrown when an operation is blocked by a locked accounting period.
 */
export class AccountingPeriodLockedError extends Error {
  readonly code = "PERIOD_LOCKED" as const
  readonly model: string
  readonly effectiveDate: Date
  readonly periodStatus: PeriodStatus

  constructor(model: string, effectiveDate: Date, periodStatus: PeriodStatus) {
    super(
      `Cannot modify ${model} with effective date ${effectiveDate.toISOString().split("T")[0]}: ` +
        `accounting period is ${periodStatus.toLowerCase()}.`
    )
    this.name = "AccountingPeriodLockedError"
    this.model = model
    this.effectiveDate = effectiveDate
    this.periodStatus = periodStatus
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      model: this.model,
      effectiveDate: this.effectiveDate.toISOString(),
      periodStatus: this.periodStatus,
    }
  }
}

/**
 * Operation types that can be blocked by period lock.
 */
export type PeriodLockOperation = "create" | "update" | "delete"

/**
 * Context for period lock enforcement.
 */
export interface PeriodLockContext {
  companyId: string
  effectiveDate: Date
  model: string
  operation: PeriodLockOperation
}

/**
 * Result of period lock check.
 */
export interface PeriodLockResult {
  allowed: boolean
  reason?: string
  periodStatus?: PeriodStatus
}

/**
 * Extract a Date value from various input formats.
 */
function extractDateValue(value: unknown): Date | null {
  if (value instanceof Date) {
    return value
  }
  if (typeof value === "string") {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  // Handle Prisma's set/update syntax
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>
    if (obj.set instanceof Date) return obj.set
    if (typeof obj.set === "string") {
      const parsed = new Date(obj.set)
      return Number.isNaN(parsed.getTime()) ? null : parsed
    }
  }
  return null
}

/**
 * Resolve the effective date for a DIRECT entity.
 */
async function resolveDirectEntityDate(
  prisma: PrismaClient,
  entity: PeriodAffectingEntity,
  data: Record<string, unknown> | undefined,
  where: Record<string, unknown> | undefined
): Promise<Date | null> {
  if (entity.dateDerivation.type !== "SELF_FIELD") {
    return null
  }

  const field = entity.dateDerivation.field

  // First, try to get the date from the data being written
  if (data) {
    const directDate = extractDateValue(data[field])
    if (directDate) {
      return directDate
    }
  }

  // If not in data, try to get from existing record (for updates/deletes)
  if (where) {
    const modelClient = (prisma as unknown as Record<string, unknown>)[entity.client] as
      | {
          findUnique?: (args: { where: unknown; select: unknown }) => Promise<Record<string, unknown> | null>
          findFirst?: (args: { where: unknown; select: unknown }) => Promise<Record<string, unknown> | null>
        }
      | undefined

    if (modelClient) {
      const finder = modelClient.findUnique ?? modelClient.findFirst
      if (finder) {
        try {
          const existing = await finder({
            where,
            select: { [field]: true },
          })
          if (existing && existing[field]) {
            return extractDateValue(existing[field])
          }
        } catch {
          // Record not found or other error - continue without date
        }
      }
    }
  }

  return null
}

/**
 * Resolve the effective date for a DERIVED entity by looking up the parent.
 */
async function resolveDerivedEntityDate(
  prisma: PrismaClient,
  entity: PeriodAffectingEntity,
  data: Record<string, unknown> | undefined,
  where: Record<string, unknown> | undefined
): Promise<Date | null> {
  if (entity.dateDerivation.type !== "PARENT_FIELD") {
    return null
  }

  const { parentModel, foreignKey, dateField } = entity.dateDerivation

  // Get the parent ID from data or where clause
  let parentId: string | null = null

  if (data && typeof data[foreignKey] === "string") {
    parentId = data[foreignKey] as string
  } else if (data && typeof data[foreignKey] === "object" && data[foreignKey] !== null) {
    // Handle Prisma connect syntax: { connect: { id: "..." } }
    const fkValue = data[foreignKey] as Record<string, unknown>
    if (fkValue.connect && typeof fkValue.connect === "object") {
      const connect = fkValue.connect as Record<string, unknown>
      if (typeof connect.id === "string") {
        parentId = connect.id
      }
    }
  }

  // If not in data, try to get from existing record
  if (!parentId && where) {
    const modelClient = (prisma as unknown as Record<string, unknown>)[entity.client] as
      | {
          findUnique?: (args: { where: unknown; select: unknown }) => Promise<Record<string, unknown> | null>
          findFirst?: (args: { where: unknown; select: unknown }) => Promise<Record<string, unknown> | null>
        }
      | undefined

    if (modelClient) {
      const finder = modelClient.findUnique ?? modelClient.findFirst
      if (finder) {
        try {
          const existing = await finder({
            where,
            select: { [foreignKey]: true },
          })
          if (existing && typeof existing[foreignKey] === "string") {
            parentId = existing[foreignKey] as string
          }
        } catch {
          // Record not found
        }
      }
    }
  }

  if (!parentId) {
    return null
  }

  // Now look up the parent's effective date
  const parentClient = (prisma as unknown as Record<string, unknown>)[
    parentModel.charAt(0).toLowerCase() + parentModel.slice(1)
  ] as
    | {
        findUnique?: (args: { where: unknown; select: unknown }) => Promise<Record<string, unknown> | null>
      }
    | undefined

  if (!parentClient?.findUnique) {
    return null
  }

  try {
    const parent = await parentClient.findUnique({
      where: { id: parentId },
      select: { [dateField]: true },
    })
    if (parent && parent[dateField]) {
      return extractDateValue(parent[dateField])
    }
  } catch {
    // Parent not found
  }

  return null
}

/**
 * Resolve the effective date for any period-affecting entity.
 */
async function resolveEffectiveDate(
  prisma: PrismaClient,
  entity: PeriodAffectingEntity,
  data: Record<string, unknown> | undefined,
  where: Record<string, unknown> | undefined
): Promise<Date | null> {
  if (entity.entityType === "DIRECT") {
    return resolveDirectEntityDate(prisma, entity, data, where)
  }
  return resolveDerivedEntityDate(prisma, entity, data, where)
}

/**
 * Resolve the company ID from context, data, or existing record.
 */
async function resolveCompanyId(
  prisma: PrismaClient,
  entity: PeriodAffectingEntity,
  data: Record<string, unknown> | undefined,
  where: Record<string, unknown> | undefined
): Promise<string | null> {
  // First priority: tenant context
  const context = getTenantContext()
  if (context?.companyId) {
    return context.companyId
  }

  // Second priority: data being written
  if (data && typeof data.companyId === "string") {
    return data.companyId
  }

  // Third priority: where clause
  if (where && typeof where.companyId === "string") {
    return where.companyId
  }

  // Last resort: look up from existing record
  if (where) {
    const modelClient = (prisma as unknown as Record<string, unknown>)[entity.client] as
      | {
          findUnique?: (args: { where: unknown; select: unknown }) => Promise<Record<string, unknown> | null>
          findFirst?: (args: { where: unknown; select: unknown }) => Promise<Record<string, unknown> | null>
        }
      | undefined

    if (modelClient) {
      const finder = modelClient.findUnique ?? modelClient.findFirst
      if (finder) {
        try {
          const existing = await finder({
            where,
            select: { companyId: true },
          })
          if (existing && typeof existing.companyId === "string") {
            return existing.companyId
          }
        } catch {
          // Record not found
        }
      }
    }
  }

  return null
}

/**
 * Check if a date falls within a locked accounting period.
 *
 * @returns The status of the locked period if blocked, null if allowed
 */
async function checkPeriodLock(
  prisma: PrismaClient,
  companyId: string,
  effectiveDate: Date
): Promise<PeriodStatus | null> {
  const lockedPeriod = await prisma.accountingPeriod.findFirst({
    where: {
      companyId,
      status: { in: Array.from(LOCKED_PERIOD_STATUSES) as PeriodStatus[] },
      startDate: { lte: effectiveDate },
      endDate: { gte: effectiveDate },
    },
    select: { status: true },
  })

  return lockedPeriod?.status ?? null
}

/**
 * Assert that an operation is allowed for the given period-affecting entity.
 *
 * This is the main entry point for period lock enforcement.
 *
 * @param prisma - Prisma client instance
 * @param model - The model name being operated on
 * @param operation - The operation type (create, update, delete)
 * @param data - The data being written (for create/update)
 * @param where - The where clause (for update/delete)
 * @throws AccountingPeriodLockedError if the operation is blocked
 */
export async function assertPeriodWritable(
  prisma: PrismaClient,
  model: string,
  operation: PeriodLockOperation,
  data?: Record<string, unknown>,
  where?: Record<string, unknown>
): Promise<void> {
  // Check if this model is period-affecting
  const entity = PERIOD_AFFECTING_ENTITIES_BY_MODEL.get(model)
  if (!entity) {
    return // Not a period-affecting entity
  }

  // Check if this operation type requires enforcement
  const shouldCheck =
    (operation === "create" && entity.checkOnCreate) ||
    (operation === "update" && entity.checkOnUpdate) ||
    (operation === "delete" && entity.checkOnDelete)

  if (!shouldCheck) {
    return
  }

  // Resolve the company ID
  const companyId = await resolveCompanyId(prisma, entity, data, where)
  if (!companyId) {
    // Cannot determine company - allow operation (tenant context will enforce elsewhere)
    return
  }

  // Resolve the effective date
  const effectiveDate = await resolveEffectiveDate(prisma, entity, data, where)
  if (!effectiveDate) {
    // Cannot determine effective date - allow operation
    // This can happen for creates where the date isn't provided yet
    return
  }

  // Check if the period is locked
  const lockedStatus = await checkPeriodLock(prisma, companyId, effectiveDate)
  if (lockedStatus) {
    throw new AccountingPeriodLockedError(model, effectiveDate, lockedStatus)
  }
}

/**
 * Check if an operation would be allowed without throwing.
 *
 * Use this for capability resolution and UI feedback.
 */
export async function checkPeriodWritable(
  prisma: PrismaClient,
  model: string,
  operation: PeriodLockOperation,
  data?: Record<string, unknown>,
  where?: Record<string, unknown>
): Promise<PeriodLockResult> {
  const entity = PERIOD_AFFECTING_ENTITIES_BY_MODEL.get(model)
  if (!entity) {
    return { allowed: true }
  }

  const shouldCheck =
    (operation === "create" && entity.checkOnCreate) ||
    (operation === "update" && entity.checkOnUpdate) ||
    (operation === "delete" && entity.checkOnDelete)

  if (!shouldCheck) {
    return { allowed: true }
  }

  const companyId = await resolveCompanyId(prisma, entity, data, where)
  if (!companyId) {
    return { allowed: true }
  }

  const effectiveDate = await resolveEffectiveDate(prisma, entity, data, where)
  if (!effectiveDate) {
    return { allowed: true }
  }

  const lockedStatus = await checkPeriodLock(prisma, companyId, effectiveDate)
  if (lockedStatus) {
    return {
      allowed: false,
      reason: `Accounting period is ${lockedStatus.toLowerCase()}`,
      periodStatus: lockedStatus,
    }
  }

  return { allowed: true }
}

/**
 * Assert that a bulk operation is allowed (for updateMany/deleteMany).
 *
 * For bulk operations, we check if ANY matching records fall within a locked period.
 */
export async function assertPeriodWritableBulk(
  prisma: PrismaClient,
  model: string,
  operation: "update" | "delete",
  where?: Record<string, unknown>
): Promise<void> {
  const entity = PERIOD_AFFECTING_ENTITIES_BY_MODEL.get(model)
  if (!entity) {
    return
  }

  const shouldCheck =
    (operation === "update" && entity.checkOnUpdate) ||
    (operation === "delete" && entity.checkOnDelete)

  if (!shouldCheck) {
    return
  }

  // For DERIVED entities, we need to handle this differently
  if (entity.entityType === "DERIVED") {
    // For derived entities in bulk operations, we skip the check
    // because it would require complex joins. The parent entity
    // enforcement will catch most cases.
    return
  }

  const companyId = await resolveCompanyId(prisma, entity, undefined, where)
  if (!companyId) {
    return
  }

  // Get all locked periods for this company
  const lockedPeriods = await prisma.accountingPeriod.findMany({
    where: {
      companyId,
      status: { in: Array.from(LOCKED_PERIOD_STATUSES) as PeriodStatus[] },
    },
    select: { startDate: true, endDate: true, status: true },
  })

  if (lockedPeriods.length === 0) {
    return // No locked periods
  }

  // Check if any matching records fall within a locked period
  if (entity.dateDerivation.type !== "SELF_FIELD") {
    return
  }

  const dateField = entity.dateDerivation.field

  const modelClient = (prisma as unknown as Record<string, unknown>)[entity.client] as
    | {
        findFirst?: (args: { where: unknown; select: unknown }) => Promise<Record<string, unknown> | null>
      }
    | undefined

  if (!modelClient?.findFirst) {
    return
  }

  // Build a query that checks for any record in a locked period
  const lockedWhere = {
    ...where,
    OR: lockedPeriods.map((period) => ({
      [dateField]: { gte: period.startDate, lte: period.endDate },
    })),
  }

  const existing = await modelClient.findFirst({
    where: lockedWhere,
    select: { [dateField]: true },
  })

  if (existing && existing[dateField]) {
    const effectiveDate = extractDateValue(existing[dateField])
    if (effectiveDate) {
      // Find which period it matches
      const matchingPeriod = lockedPeriods.find(
        (p) => effectiveDate >= p.startDate && effectiveDate <= p.endDate
      )
      throw new AccountingPeriodLockedError(
        model,
        effectiveDate,
        matchingPeriod?.status ?? "LOCKED"
      )
    }
  }
}
