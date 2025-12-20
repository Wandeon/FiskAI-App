import { db } from "@/lib/db"
import { THRESHOLDS } from "@/lib/fiscal-data/data/thresholds"

export interface TenantHealth {
  onboardingComplete: boolean
  onboardingStep: number
  tutorialProgress: number
  competenceLevel: string
  lastLoginAt: Date | null
  thirtyDayActivity: number
}

export interface LimitTracker {
  currentRevenue: number
  limit: number
  percentage: number
  projectedYearly: number
  status: "safe" | "warning" | "critical"
}

export interface TenantProfile {
  id: string
  name: string
  oib: string
  legalForm: string
  isVatPayer: boolean
  createdAt: Date
}

export interface TenantSubscription {
  plan: string
  status: string
  mrr: number
  startedAt: Date | null
}

export interface TenantOwner {
  email: string
  name: string | null
  lastLoginAt: Date | null
}

export interface TenantDetail {
  profile: TenantProfile
  subscription: TenantSubscription
  owner: TenantOwner | null
  health: TenantHealth
  limitTracker: LimitTracker
  modules: string[]
  flags: string[]
}

export async function getTenantDetail(companyId: string): Promise<TenantDetail | null> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    include: {
      users: {
        where: { role: "OWNER" },
        include: { user: true },
      },
      eInvoices: {
        where: {
          createdAt: { gte: new Date(new Date().getFullYear(), 0, 1) },
          status: { not: "DRAFT" },
        },
        select: { totalAmount: true },
      },
    },
  })

  if (!company) return null

  const owner = company.users[0]?.user
  const yearlyRevenue = company.eInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0)
  const limit = THRESHOLDS.pausalni.value

  // Calculate projected yearly (based on current month)
  const currentMonth = new Date().getMonth() + 1
  const projectedYearly = currentMonth > 0 ? (yearlyRevenue / currentMonth) * 12 : yearlyRevenue

  // Calculate 30-day activity
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const recentActivity = await db.eInvoice.count({
    where: { companyId, createdAt: { gte: thirtyDaysAgo } },
  })

  // Use fiscalEnabled as proxy for onboarding completion
  const onboardingComplete = company.fiscalEnabled && company.eInvoices.length > 0
  const onboardingStep = company.fiscalEnabled ? (company.eInvoices.length > 0 ? 5 : 4) : 1

  return {
    profile: {
      id: company.id,
      name: company.name,
      oib: company.oib || "",
      legalForm: company.legalForm || "UNKNOWN",
      isVatPayer: company.isVatPayer,
      createdAt: company.createdAt,
    },
    subscription: {
      plan: company.subscriptionPlan || "free",
      status: company.subscriptionStatus || "none",
      mrr: 0, // TODO: Calculate from Stripe
      startedAt: company.subscriptionCurrentPeriodStart,
    },
    owner: owner
      ? {
          email: owner.email,
          name: owner.name,
          lastLoginAt: owner.updatedAt, // Using updatedAt as proxy for lastLoginAt
        }
      : null,
    health: {
      onboardingComplete,
      onboardingStep,
      tutorialProgress: 0, // TODO: Calculate from tutorial_progress table
      competenceLevel: (company.featureFlags as any)?.competence || "beginner",
      lastLoginAt: owner?.updatedAt || null,
      thirtyDayActivity: recentActivity,
    },
    limitTracker: {
      currentRevenue: yearlyRevenue,
      limit,
      percentage: (yearlyRevenue / limit) * 100,
      projectedYearly,
      status:
        yearlyRevenue >= limit * 0.95
          ? "critical"
          : yearlyRevenue >= limit * 0.85
            ? "warning"
            : "safe",
    },
    modules: (company.entitlements as string[]) || [],
    flags: calculateFlags(company, yearlyRevenue, limit, owner?.updatedAt),
  }
}

function calculateFlags(
  company: any,
  revenue: number,
  limit: number,
  lastLogin: Date | null
): string[] {
  const flags: string[] = []
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Check if stuck in onboarding (created more than 7 days ago without fiscal enabled)
  if (!company.fiscalEnabled && company.createdAt < sevenDaysAgo) {
    flags.push("stuck-onboarding")
  }
  if (revenue >= limit * 0.85) {
    flags.push("approaching-limit")
  }
  if (revenue >= limit * 0.95) {
    flags.push("critical-limit")
  }
  if (!lastLogin || lastLogin < thirtyDaysAgo) {
    flags.push("inactive")
  }

  return flags
}
