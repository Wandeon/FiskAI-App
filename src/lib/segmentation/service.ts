/**
 * Segment Service
 *
 * High-level operations for managing user segments and feature targeting.
 */

import { db as prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import type {
  SegmentRules,
  CompanyAttributes,
  SegmentEvaluationResult,
  SegmentWithStats,
} from "./types"
import { SYSTEM_SEGMENTS } from "./types"
import { evaluateRules, evaluateSegments } from "./evaluator"

// Local type for segment status since prisma types may not be generated yet
type SegmentStatus = "DRAFT" | "ACTIVE" | "ARCHIVED"

// Local interface matching UserSegment model
interface UserSegment {
  id: string
  name: string
  description: string | null
  status: SegmentStatus
  rules: Prisma.JsonValue
  memberCount: number
  lastEvaluatedAt: Date | null
  category: string | null
  tags: string[]
  isSystem: boolean
  createdAt: Date
  updatedAt: Date
  createdBy: string | null
  updatedBy: string | null
}

/**
 * Create a new segment
 */
export async function createSegment(data: {
  name: string
  description?: string
  rules: SegmentRules
  category?: string
  tags?: string[]
  createdBy?: string
}): Promise<UserSegment> {
  return prisma.userSegment.create({
    data: {
      name: data.name,
      description: data.description,
      rules: data.rules as Prisma.InputJsonValue,
      category: data.category,
      tags: data.tags ?? [],
      createdBy: data.createdBy,
      status: "DRAFT",
    },
  })
}

/**
 * Update segment rules
 */
export async function updateSegment(
  id: string,
  data: {
    name?: string
    description?: string
    rules?: SegmentRules
    status?: SegmentStatus
    category?: string
    tags?: string[]
    updatedBy?: string
  }
): Promise<UserSegment> {
  return prisma.userSegment.update({
    where: { id },
    data: {
      ...data,
      rules: data.rules ? (data.rules as Prisma.InputJsonValue) : undefined,
    },
  })
}

/**
 * Delete a segment (only non-system segments)
 */
export async function deleteSegment(id: string): Promise<void> {
  const segment = await prisma.userSegment.findUnique({ where: { id } })
  if (segment?.isSystem) {
    throw new Error("Cannot delete system segment")
  }

  await prisma.userSegment.delete({ where: { id } })
}

/**
 * Get segment by ID
 */
export async function getSegment(id: string): Promise<UserSegment | null> {
  return prisma.userSegment.findUnique({ where: { id } })
}

/**
 * Get segment by name
 */
export async function getSegmentByName(name: string): Promise<UserSegment | null> {
  return prisma.userSegment.findUnique({ where: { name } })
}

/**
 * List all active segments
 */
export async function listSegments(options?: {
  status?: SegmentStatus
  category?: string
  includeSystem?: boolean
}): Promise<SegmentWithStats[]> {
  const where: Prisma.UserSegmentWhereInput = {}

  if (options?.status) {
    where.status = options.status
  }
  if (options?.category) {
    where.category = options.category
  }
  if (options?.includeSystem === false) {
    where.isSystem = false
  }

  const segments = await prisma.userSegment.findMany({
    where,
    orderBy: [{ category: "asc" }, { name: "asc" }],
  })

  return segments.map((s) => ({
    ...s,
    rules: s.rules as SegmentRules,
  }))
}

/**
 * Get company attributes for segment evaluation
 */
export async function getCompanyAttributes(companyId: string): Promise<CompanyAttributes | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      legalForm: true,
      isVatPayer: true,
      country: true,
      subscriptionStatus: true,
      subscriptionPlan: true,
      trialEndsAt: true,
      invoiceLimit: true,
      userLimit: true,
      fiscalEnabled: true,
      createdAt: true,
      entitlements: true,
    },
  })

  if (!company) return null

  // Extract entitlements as array
  let entitlements: string[] | null = null
  if (Array.isArray(company.entitlements)) {
    entitlements = company.entitlements as string[]
  } else if (
    company.entitlements &&
    typeof company.entitlements === "object" &&
    "modules" in company.entitlements
  ) {
    // V2 entitlements - extract enabled module keys
    const v2 = company.entitlements as { modules: Record<string, unknown> }
    entitlements = Object.keys(v2.modules).filter((k) => v2.modules[k] !== null)
  }

  return {
    id: company.id,
    legalForm: company.legalForm,
    isVatPayer: company.isVatPayer,
    country: company.country,
    subscriptionStatus: company.subscriptionStatus,
    subscriptionPlan: company.subscriptionPlan,
    trialEndsAt: company.trialEndsAt,
    invoiceLimit: company.invoiceLimit,
    userLimit: company.userLimit,
    fiscalEnabled: company.fiscalEnabled,
    createdAt: company.createdAt,
    entitlements,
  }
}

/**
 * Get all company attributes for batch evaluation
 */
export async function getAllCompanyAttributes(): Promise<CompanyAttributes[]> {
  const companies = await prisma.company.findMany({
    select: {
      id: true,
      legalForm: true,
      isVatPayer: true,
      country: true,
      subscriptionStatus: true,
      subscriptionPlan: true,
      trialEndsAt: true,
      invoiceLimit: true,
      userLimit: true,
      fiscalEnabled: true,
      createdAt: true,
      entitlements: true,
    },
  })

  return companies.map((company) => {
    let entitlements: string[] | null = null
    if (Array.isArray(company.entitlements)) {
      entitlements = company.entitlements as string[]
    } else if (
      company.entitlements &&
      typeof company.entitlements === "object" &&
      "modules" in company.entitlements
    ) {
      const v2 = company.entitlements as { modules: Record<string, unknown> }
      entitlements = Object.keys(v2.modules).filter((k) => v2.modules[k] !== null)
    }

    return {
      id: company.id,
      legalForm: company.legalForm,
      isVatPayer: company.isVatPayer,
      country: company.country,
      subscriptionStatus: company.subscriptionStatus,
      subscriptionPlan: company.subscriptionPlan,
      trialEndsAt: company.trialEndsAt,
      invoiceLimit: company.invoiceLimit,
      userLimit: company.userLimit,
      fiscalEnabled: company.fiscalEnabled,
      createdAt: company.createdAt,
      entitlements,
    }
  })
}

/**
 * Evaluate all segments for a company
 */
export async function evaluateCompanySegments(
  companyId: string
): Promise<SegmentEvaluationResult[]> {
  const [company, segments] = await Promise.all([
    getCompanyAttributes(companyId),
    listSegments({ status: "ACTIVE" }),
  ])

  if (!company) {
    return []
  }

  return evaluateSegments(
    segments.map((s) => ({ id: s.id, name: s.name, rules: s.rules })),
    company
  )
}

/**
 * Check if company belongs to a specific segment
 */
export async function isCompanyInSegment(companyId: string, segmentName: string): Promise<boolean> {
  const [company, segment] = await Promise.all([
    getCompanyAttributes(companyId),
    getSegmentByName(segmentName),
  ])

  if (!company || !segment) {
    return false
  }

  return evaluateRules(segment.rules as SegmentRules, company)
}

/**
 * Get all companies in a segment
 */
export async function getSegmentMembers(
  segmentId: string
): Promise<{ companyId: string; companyName: string }[]> {
  const segment = await prisma.userSegment.findUnique({ where: { id: segmentId } })
  if (!segment) return []

  const rules = segment.rules as SegmentRules
  const companies = await getAllCompanyAttributes()

  const memberIds = companies.filter((c) => evaluateRules(rules, c)).map((c) => c.id)

  const memberDetails = await prisma.company.findMany({
    where: { id: { in: memberIds } },
    select: { id: true, name: true },
  })

  return memberDetails.map((c) => ({ companyId: c.id, companyName: c.name }))
}

/**
 * Update segment member count (call periodically or after changes)
 */
export async function updateSegmentMemberCount(segmentId: string): Promise<number> {
  const segment = await prisma.userSegment.findUnique({ where: { id: segmentId } })
  if (!segment) return 0

  const rules = segment.rules as SegmentRules
  const companies = await getAllCompanyAttributes()
  const memberCount = companies.filter((c) => evaluateRules(rules, c)).length

  await prisma.userSegment.update({
    where: { id: segmentId },
    data: {
      memberCount,
      lastEvaluatedAt: new Date(),
    },
  })

  return memberCount
}

/**
 * Update all segment member counts
 */
export async function updateAllSegmentCounts(): Promise<void> {
  const segments = await prisma.userSegment.findMany({ where: { status: "ACTIVE" } })
  const companies = await getAllCompanyAttributes()

  for (const segment of segments) {
    const rules = segment.rules as SegmentRules
    const memberCount = companies.filter((c) => evaluateRules(rules, c)).length

    await prisma.userSegment.update({
      where: { id: segment.id },
      data: {
        memberCount,
        lastEvaluatedAt: new Date(),
      },
    })
  }
}

/**
 * Track segment membership change
 */
export async function trackMembershipChange(
  segmentId: string,
  companyId: string,
  joined: boolean,
  attributes?: CompanyAttributes
): Promise<void> {
  await prisma.segmentMembershipHistory.create({
    data: {
      segmentId,
      companyId,
      joined,
      attributeSnapshot: attributes as Prisma.InputJsonValue,
    },
  })
}

/**
 * Initialize system segments (call on startup/migration)
 */
export async function initializeSystemSegments(): Promise<void> {
  for (const segment of SYSTEM_SEGMENTS) {
    const existing = await prisma.userSegment.findUnique({
      where: { name: segment.name },
    })

    if (!existing) {
      await prisma.userSegment.create({
        data: {
          name: segment.name,
          description: segment.description,
          category: segment.category,
          rules: segment.rules as Prisma.InputJsonValue,
          status: "ACTIVE",
          isSystem: true,
          tags: [],
        },
      })
    }
  }
}

/**
 * Connect segment to feature flag for targeting
 */
export async function connectSegmentToFeature(
  segmentId: string,
  flagId: string,
  options?: {
    enabled?: boolean
    priority?: number
    startsAt?: Date
    expiresAt?: Date
  }
): Promise<void> {
  await prisma.segmentFeatureTarget.upsert({
    where: {
      segmentId_flagId: { segmentId, flagId },
    },
    create: {
      segmentId,
      flagId,
      enabled: options?.enabled ?? true,
      priority: options?.priority ?? 0,
      startsAt: options?.startsAt,
      expiresAt: options?.expiresAt,
    },
    update: {
      enabled: options?.enabled,
      priority: options?.priority,
      startsAt: options?.startsAt,
      expiresAt: options?.expiresAt,
    },
  })
}

/**
 * Remove segment from feature flag targeting
 */
export async function disconnectSegmentFromFeature(
  segmentId: string,
  flagId: string
): Promise<void> {
  await prisma.segmentFeatureTarget.deleteMany({
    where: { segmentId, flagId },
  })
}

/**
 * Check if feature is enabled for company based on segment targeting
 */
export async function isFeatureEnabledForCompany(
  flagKey: string,
  companyId: string
): Promise<{ enabled: boolean; reason: string }> {
  // Get feature flag
  const flag = await prisma.featureFlag.findUnique({
    where: { key: flagKey },
    include: {
      segmentTargets: {
        include: { segment: true },
        orderBy: { priority: "desc" },
      },
    },
  })

  if (!flag) {
    return { enabled: false, reason: "Feature flag not found" }
  }

  if (flag.status !== "ACTIVE") {
    return { enabled: false, reason: "Feature flag is not active" }
  }

  // Check for company-specific override first
  const override = await prisma.featureFlagOverride.findFirst({
    where: {
      flagId: flag.id,
      companyId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  })

  if (override) {
    return {
      enabled: override.enabled,
      reason: `Company-specific override: ${override.enabled ? "enabled" : "disabled"}`,
    }
  }

  // Check segment targeting
  const company = await getCompanyAttributes(companyId)
  if (!company) {
    return { enabled: flag.defaultValue, reason: "Company not found, using default" }
  }

  const now = new Date()
  for (const target of flag.segmentTargets) {
    // Check scheduling
    if (target.startsAt && target.startsAt > now) continue
    if (target.expiresAt && target.expiresAt < now) continue

    const rules = target.segment.rules as SegmentRules
    if (evaluateRules(rules, company)) {
      return {
        enabled: target.enabled,
        reason: `Segment match: ${target.segment.name}`,
      }
    }
  }

  // No segment match, check rollout percentage
  if (flag.rolloutPercentage > 0 && flag.rolloutPercentage < 100) {
    // Use company ID hash for consistent rollout
    const hash = hashString(companyId)
    const bucket = hash % 100
    if (bucket < flag.rolloutPercentage) {
      return { enabled: true, reason: `Rollout: ${flag.rolloutPercentage}%` }
    }
  }

  return { enabled: flag.defaultValue, reason: "Default value" }
}

/**
 * Simple string hash for consistent rollout
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}
