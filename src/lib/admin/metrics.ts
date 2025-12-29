import { db } from "@/lib/db"

export interface AdminMetrics {
  totalTenants: number
  activeSubscriptions: number
  thisWeekSignups: number
  needsHelp: number
}

export interface OnboardingFunnel {
  started: number
  step2: number
  step3: number
  step4: number
  completed: number
  firstInvoice: number
}

export interface ComplianceHealth {
  certificatesActive: number
  certificatesExpiring: number
  certificatesMissing: number
  fiscalizedToday: number
  successRate: number
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [totalTenants, activeSubscriptions, thisWeekSignups, needsHelp] = await Promise.all([
    db.company.count(),
    db.company.count({ where: { subscriptionStatus: "active" } }),
    db.company.count({ where: { createdAt: { gte: oneWeekAgo } } }),
    db.company.count({
      where: {
        OR: [
          // Companies created more than 7 days ago without fiscal setup
          {
            createdAt: { lte: sevenDaysAgo },
            fiscalEnabled: false,
          },
        ],
      },
    }),
  ])

  return { totalTenants, activeSubscriptions, thisWeekSignups, needsHelp }
}

export async function getOnboardingFunnel(): Promise<OnboardingFunnel> {
  const companies = await db.company.findMany({
    select: {
      fiscalEnabled: true,
      _count: { select: { eInvoices: true } },
    },
  })

  // Since we don't have onboardingStep field, we'll use proxy metrics
  // Step 2: Has fiscal enabled
  // Step 3: Has at least 1 invoice
  // Step 4: Has at least 5 invoices
  // Completed: Has fiscal enabled and at least 1 invoice
  const step2 = companies.filter((c) => c.fiscalEnabled).length
  const step3 = companies.filter((c) => c._count.eInvoices >= 1).length
  const step4 = companies.filter((c) => c._count.eInvoices >= 5).length
  const completed = companies.filter((c) => c.fiscalEnabled && c._count.eInvoices >= 1).length
  const firstInvoice = companies.filter((c) => c._count.eInvoices > 0).length

  return {
    started: companies.length,
    step2,
    step3,
    step4,
    completed,
    firstInvoice,
  }
}

export async function getComplianceHealth(): Promise<ComplianceHealth> {
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [activeCount, expiringCount, missingCount, todayInvoices] = await Promise.all([
    db.fiscalCertificate.count({
      where: { certNotAfter: { gt: thirtyDaysFromNow } },
    }),
    db.fiscalCertificate.count({
      where: {
        certNotAfter: { lte: thirtyDaysFromNow, gte: new Date() },
      },
    }),
    db.company.count({
      where: {
        fiscalCertificates: { none: {} },
        legalForm: { in: ["OBRT_PAUSAL", "OBRT_REAL", "OBRT_VAT"] },
      },
    }),
    db.eInvoice.count({
      where: { fiscalizedAt: { gte: today }, jir: { not: null } },
    }),
  ])

  const allFiscalized = await db.eInvoice.count({ where: { jir: { not: null } } })
  const totalAttempts = await db.eInvoice.count({ where: { fiscalizedAt: { not: null } } })

  return {
    certificatesActive: activeCount,
    certificatesExpiring: expiringCount,
    certificatesMissing: missingCount,
    fiscalizedToday: todayInvoices,
    successRate: totalAttempts > 0 ? Math.round((allFiscalized / totalAttempts) * 100) : 100,
  }
}

export interface RecentSignup {
  id: string
  name: string
  legalForm: string
  createdAt: Date
  subscriptionStatus: string | null
}

export async function getRecentSignups(limit: number = 5): Promise<RecentSignup[]> {
  const companies = await db.company.findMany({
    select: {
      id: true,
      name: true,
      legalForm: true,
      createdAt: true,
      subscriptionStatus: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  })

  return companies
}
