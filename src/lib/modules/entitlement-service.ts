/**
 * Entitlement Service
 *
 * Provides database operations for managing module entitlements
 * with automatic audit logging.
 */

import { prisma } from "@/lib/prisma"
import type { EntitlementHistory } from "@prisma/client"
import type { ModuleKey } from "./definitions"
import {
  type CompanyEntitlements,
  type PermissionAction,
  type LegacyEntitlements,
  isV2Entitlements,
  migrateEntitlements,
  createPlanEntitlements,
  grantTrialEntitlement,
  revokeEntitlement,
  updateModulePermissions,
  DEFAULT_MODULE_PERMISSIONS,
} from "./permissions"
import { detectEntitlementChanges } from "./audit"

export interface EntitlementUpdateContext {
  userId: string
  ipAddress?: string
  userAgent?: string
  reason?: string
}

/**
 * Get current entitlements for a company
 */
export async function getCompanyEntitlements(
  companyId: string
): Promise<CompanyEntitlements | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { entitlements: true },
  })

  if (!company?.entitlements) return null

  const entitlements = company.entitlements as CompanyEntitlements | LegacyEntitlements

  // Return as-is if already v2
  if (isV2Entitlements(entitlements)) {
    return entitlements
  }

  // Legacy format - don't migrate automatically, just return null to indicate needs migration
  return null
}

/**
 * Migrate legacy entitlements to v2 format with audit logging
 */
export async function migrateCompanyEntitlements(
  companyId: string,
  context: EntitlementUpdateContext
): Promise<CompanyEntitlements> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { entitlements: true },
  })

  const rawEntitlements = company?.entitlements as CompanyEntitlements | LegacyEntitlements | null

  // If already v2, return as-is
  if (isV2Entitlements(rawEntitlements)) {
    return rawEntitlements
  }

  // Migrate from legacy format
  const legacy = Array.isArray(rawEntitlements) ? rawEntitlements : []
  const migrated = migrateEntitlements(legacy, context.userId)

  // Update company with new entitlements
  await prisma.company.update({
    where: { id: companyId },
    data: { entitlements: migrated as unknown as Record<string, unknown> },
  })

  // Log the migration
  await prisma.entitlementHistory.create({
    data: {
      companyId,
      userId: context.userId,
      changeType: "ENTITLEMENTS_MIGRATED",
      previousValue: legacy as unknown as Record<string, unknown>,
      newValue: migrated as unknown as Record<string, unknown>,
      reason: context.reason ?? "Automated migration to v2 entitlements",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    },
  })

  return migrated
}

/**
 * Enable a module for a company with specified permissions
 */
export async function enableModule(
  companyId: string,
  moduleKey: ModuleKey,
  permissions: PermissionAction[] = DEFAULT_MODULE_PERMISSIONS,
  context: EntitlementUpdateContext
): Promise<CompanyEntitlements> {
  // Ensure we have v2 entitlements
  let entitlements = await getCompanyEntitlements(companyId)
  if (!entitlements) {
    entitlements = await migrateCompanyEntitlements(companyId, context)
  }

  const previous = { ...entitlements }

  // Update entitlements
  const updated = updateModulePermissions(
    entitlements,
    moduleKey,
    permissions,
    context.userId,
    context.reason
  )

  // Detect changes and create audit entries
  const changes = detectEntitlementChanges(previous, updated, context.userId, companyId, {
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    reason: context.reason,
  })

  // Persist changes
  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: { entitlements: updated as unknown as Record<string, unknown> },
    }),
    ...changes.map((change) =>
      prisma.entitlementHistory.create({
        data: {
          companyId: change.companyId,
          userId: change.userId,
          changeType: change.changeType,
          moduleKey: change.moduleKey,
          previousValue: change.previousValue as unknown as Record<string, unknown>,
          newValue: change.newValue as unknown as Record<string, unknown>,
          previousPlan: change.previousPlan,
          newPlan: change.newPlan,
          reason: change.reason,
          metadata: change.metadata as unknown as Record<string, unknown>,
          ipAddress: change.ipAddress,
          userAgent: change.userAgent,
        },
      })
    ),
  ])

  return updated
}

/**
 * Disable a module for a company
 */
export async function disableModule(
  companyId: string,
  moduleKey: ModuleKey,
  context: EntitlementUpdateContext
): Promise<CompanyEntitlements> {
  // Ensure we have v2 entitlements
  let entitlements = await getCompanyEntitlements(companyId)
  if (!entitlements) {
    entitlements = await migrateCompanyEntitlements(companyId, context)
  }

  const previous = { ...entitlements }

  // Revoke the module
  const updated = revokeEntitlement(entitlements, moduleKey)

  // Detect changes and create audit entries
  const changes = detectEntitlementChanges(previous, updated, context.userId, companyId, {
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    reason: context.reason,
  })

  // Persist changes
  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: { entitlements: updated as unknown as Record<string, unknown> },
    }),
    ...changes.map((change) =>
      prisma.entitlementHistory.create({
        data: {
          companyId: change.companyId,
          userId: change.userId,
          changeType: change.changeType,
          moduleKey: change.moduleKey,
          previousValue: change.previousValue as unknown as Record<string, unknown>,
          newValue: change.newValue as unknown as Record<string, unknown>,
          previousPlan: change.previousPlan,
          newPlan: change.newPlan,
          reason: change.reason,
          metadata: change.metadata as unknown as Record<string, unknown>,
          ipAddress: change.ipAddress,
          userAgent: change.userAgent,
        },
      })
    ),
  ])

  return updated
}

/**
 * Start a trial for a module
 */
export async function startModuleTrial(
  companyId: string,
  moduleKey: ModuleKey,
  trialDays: number,
  context: EntitlementUpdateContext
): Promise<CompanyEntitlements> {
  // Ensure we have v2 entitlements
  let entitlements = await getCompanyEntitlements(companyId)
  if (!entitlements) {
    entitlements = await migrateCompanyEntitlements(companyId, context)
  }

  const previous = { ...entitlements }

  // Grant trial entitlement
  const updated = grantTrialEntitlement(entitlements, moduleKey, trialDays, context.userId)

  // Detect changes and create audit entries
  const changes = detectEntitlementChanges(previous, updated, context.userId, companyId, {
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    reason: context.reason ?? `${trialDays}-day trial started`,
  })

  // Persist changes
  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: { entitlements: updated as unknown as Record<string, unknown> },
    }),
    ...changes.map((change) =>
      prisma.entitlementHistory.create({
        data: {
          companyId: change.companyId,
          userId: change.userId,
          changeType: change.changeType,
          moduleKey: change.moduleKey,
          previousValue: change.previousValue as unknown as Record<string, unknown>,
          newValue: change.newValue as unknown as Record<string, unknown>,
          previousPlan: change.previousPlan,
          newPlan: change.newPlan,
          reason: change.reason,
          metadata: change.metadata as unknown as Record<string, unknown>,
          ipAddress: change.ipAddress,
          userAgent: change.userAgent,
        },
      })
    ),
  ])

  return updated
}

/**
 * Change subscription plan for a company
 */
export async function changeSubscriptionPlan(
  companyId: string,
  newPlan: string,
  context: EntitlementUpdateContext
): Promise<CompanyEntitlements> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { entitlements: true },
  })

  const previousEntitlements = company?.entitlements as CompanyEntitlements | null

  // Create new entitlements based on plan
  const updated = createPlanEntitlements(newPlan, context.userId)

  // Detect changes and create audit entries
  const changes = detectEntitlementChanges(
    previousEntitlements,
    updated,
    context.userId,
    companyId,
    {
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      reason: context.reason ?? `Plan changed to ${newPlan}`,
    }
  )

  // Persist changes
  await prisma.$transaction([
    prisma.company.update({
      where: { id: companyId },
      data: { entitlements: updated as unknown as Record<string, unknown> },
    }),
    ...changes.map((change) =>
      prisma.entitlementHistory.create({
        data: {
          companyId: change.companyId,
          userId: change.userId,
          changeType: change.changeType,
          moduleKey: change.moduleKey,
          previousValue: change.previousValue as unknown as Record<string, unknown>,
          newValue: change.newValue as unknown as Record<string, unknown>,
          previousPlan: change.previousPlan,
          newPlan: change.newPlan,
          reason: change.reason,
          metadata: change.metadata as unknown as Record<string, unknown>,
          ipAddress: change.ipAddress,
          userAgent: change.userAgent,
        },
      })
    ),
  ])

  return updated
}

/**
 * Get entitlement history for a company
 */
export async function getEntitlementHistory(
  companyId: string,
  options?: {
    moduleKey?: ModuleKey
    limit?: number
    offset?: number
  }
): Promise<EntitlementHistory[]> {
  return prisma.entitlementHistory.findMany({
    where: {
      companyId,
      ...(options?.moduleKey ? { moduleKey: options.moduleKey } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 100,
    skip: options?.offset ?? 0,
  })
}

/**
 * Check and expire trial entitlements
 * This should be called by a scheduled job
 */
export async function expireTrialEntitlements(): Promise<number> {
  const companies = await prisma.company.findMany({
    select: { id: true, entitlements: true },
  })

  let expiredCount = 0

  for (const company of companies) {
    const entitlements = company.entitlements as CompanyEntitlements | null
    if (!isV2Entitlements(entitlements)) continue

    let hasExpired = false
    const updated = { ...entitlements, modules: { ...entitlements.modules } }

    for (const [key, value] of Object.entries(entitlements.modules)) {
      if (value?.expiresAt && new Date(value.expiresAt) < new Date()) {
        // Remove expired entitlement
        delete updated.modules[key as ModuleKey]
        hasExpired = true
        expiredCount++

        // Log the expiration
        await prisma.entitlementHistory.create({
          data: {
            companyId: company.id,
            userId: "system",
            changeType: "TRIAL_EXPIRED",
            moduleKey: key,
            previousValue: value as unknown as Record<string, unknown>,
            newValue: {} as Record<string, unknown>,
            reason: "Trial period expired",
          },
        })
      }
    }

    if (hasExpired) {
      await prisma.company.update({
        where: { id: company.id },
        data: { entitlements: updated as unknown as Record<string, unknown> },
      })
    }
  }

  return expiredCount
}
