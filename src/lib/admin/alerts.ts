import { db } from "@/lib/db"
import { THRESHOLDS } from "@/lib/fiscal-data/data/thresholds"
import type { AdminAlertStatus } from "@prisma/client"

export type AlertLevel = "critical" | "warning" | "info"
export type AlertType =
  | "onboarding-stuck"
  | "approaching-limit"
  | "critical-limit"
  | "cert-expiring"
  | "cert-expired"
  | "inactive"
  | "support-ticket"

export interface Alert {
  id: string
  type: AlertType
  level: AlertLevel
  companyId: string
  companyName: string
  title: string
  description: string
  createdAt: Date
  autoAction?: string
  status?: AdminAlertStatus
  dbId?: string // Database ID for persisted alerts
}

export async function getActiveAlerts(): Promise<Alert[]> {
  const alerts: Alert[] = []
  const limit = THRESHOLDS.pausalni.value

  // Get dismissed/resolved alerts to filter them out
  const dismissedAlerts = await db.adminAlert.findMany({
    where: {
      status: { in: ["DISMISSED", "RESOLVED"] },
    },
    select: {
      id: true,
      type: true,
      companyId: true,
      status: true,
    },
  })

  const dismissedMap = new Map(dismissedAlerts.map((a) => [`${a.type}-${a.companyId}`, a]))

  // Stuck in onboarding >7 days
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const stuckCompanies = await db.company.findMany({
    where: {
      fiscalEnabled: false,
      createdAt: { lte: sevenDaysAgo },
    },
    select: { id: true, name: true, createdAt: true },
  })

  for (const company of stuckCompanies) {
    const key = `onboarding-stuck-${company.id}`
    if (dismissedMap.has(key)) continue

    alerts.push({
      id: `stuck-${company.id}`,
      type: "onboarding-stuck",
      level: "critical",
      companyId: company.id,
      companyName: company.name,
      title: "Stuck in onboarding",
      description: `Started ${Math.ceil((Date.now() - company.createdAt.getTime()) / (1000 * 60 * 60 * 24))} days ago`,
      createdAt: company.createdAt,
      autoAction: "Queue reminder email",
    })
  }

  // Approaching 60k limit
  const companies = await db.company.findMany({
    where: { legalForm: "OBRT_PAUSAL" },
    include: {
      eInvoices: {
        where: {
          createdAt: { gte: new Date(new Date().getFullYear(), 0, 1) },
          status: { not: "DRAFT" },
        },
        select: { totalAmount: true },
      },
    },
  })

  for (const company of companies) {
    const revenue = company.eInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0)

    if (revenue >= limit * 0.95) {
      const key = `critical-limit-${company.id}`
      if (dismissedMap.has(key)) continue

      alerts.push({
        id: `limit-critical-${company.id}`,
        type: "critical-limit",
        level: "critical",
        companyId: company.id,
        companyName: company.name,
        title: "95% of 60k limit",
        description: `Current: €${revenue.toFixed(2)}`,
        createdAt: new Date(),
        autoAction: "Urgent outreach",
      })
    } else if (revenue >= limit * 0.85) {
      const key = `approaching-limit-${company.id}`
      if (dismissedMap.has(key)) continue

      alerts.push({
        id: `limit-warning-${company.id}`,
        type: "approaching-limit",
        level: "warning",
        companyId: company.id,
        companyName: company.name,
        title: "85% of 60k limit",
        description: `Current: €${revenue.toFixed(2)}`,
        createdAt: new Date(),
        autoAction: "Send threshold guide",
      })
    }
  }

  // Certificate expiring
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const expiringCerts = await db.fiscalCertificate.findMany({
    where: {
      certNotAfter: { lte: thirtyDaysFromNow, gte: new Date() },
    },
    include: { company: { select: { id: true, name: true } } },
  })

  for (const cert of expiringCerts) {
    if (!cert.company) continue
    const daysRemaining = Math.ceil(
      (cert.certNotAfter.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )

    const key = `cert-expiring-${cert.company.id}`
    if (dismissedMap.has(key)) continue

    alerts.push({
      id: `cert-expiring-${cert.id}`,
      type: "cert-expiring",
      level: daysRemaining <= 7 ? "critical" : "warning",
      companyId: cert.company.id,
      companyName: cert.company.name,
      title: "Certificate expiring",
      description: `${daysRemaining} days remaining`,
      createdAt: new Date(),
      autoAction: "Send renewal notice",
    })
  }

  // Sort by level (critical first)
  return alerts.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 }
    return order[a.level] - order[b.level]
  })
}

export async function dismissAlert(companyId: string, type: string, userId: string): Promise<void> {
  await db.adminAlert.upsert({
    where: {
      companyId_type: {
        companyId,
        type,
      },
    },
    update: {
      status: "DISMISSED",
      dismissedAt: new Date(),
      dismissedBy: userId,
    },
    create: {
      companyId,
      type,
      level: "info", // Default level for manually dismissed
      title: "Dismissed alert",
      description: "Alert was dismissed by admin",
      status: "DISMISSED",
      dismissedAt: new Date(),
      dismissedBy: userId,
    },
  })
}

export async function resolveAlert(companyId: string, type: string, userId: string): Promise<void> {
  await db.adminAlert.upsert({
    where: {
      companyId_type: {
        companyId,
        type,
      },
    },
    update: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedBy: userId,
    },
    create: {
      companyId,
      type,
      level: "info", // Default level for manually resolved
      title: "Resolved alert",
      description: "Alert was resolved by admin",
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedBy: userId,
    },
  })
}

export async function acknowledgeAlert(
  companyId: string,
  type: string,
  userId: string
): Promise<void> {
  await db.adminAlert.upsert({
    where: {
      companyId_type: {
        companyId,
        type,
      },
    },
    update: {
      status: "ACKNOWLEDGED",
      acknowledgedAt: new Date(),
      acknowledgedBy: userId,
    },
    create: {
      companyId,
      type,
      level: "info", // Default level for manually acknowledged
      title: "Acknowledged alert",
      description: "Alert was acknowledged by admin",
      status: "ACKNOWLEDGED",
      acknowledgedAt: new Date(),
      acknowledgedBy: userId,
    },
  })
}

export async function snoozeAlert(
  companyId: string,
  type: string,
  userId: string,
  snoozedUntil: Date
): Promise<void> {
  await db.adminAlert.upsert({
    where: {
      companyId_type: {
        companyId,
        type,
      },
    },
    update: {
      snoozedUntil,
      acknowledgedBy: userId,
      acknowledgedAt: new Date(),
    },
    create: {
      companyId,
      type,
      level: "info", // Default level for manually snoozed
      title: "Snoozed alert",
      description: "Alert was snoozed by admin",
      status: "ACTIVE",
      snoozedUntil,
      acknowledgedBy: userId,
      acknowledgedAt: new Date(),
    },
  })
}
