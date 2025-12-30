import { Metadata } from "next"
import dynamic from "next/dynamic"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import type {
  CertificateStatus,
  FiscalizationStats,
  ComplianceData,
  ReportingStatusSummary,
  AccountingPeriodSummary,
} from "./compliance-dashboard"
import { ensureReportingStatuses } from "@/lib/reporting/status-service"

// Dynamic import for heavy ComplianceDashboard component
const ComplianceDashboard = dynamic(
  () => import("./compliance-dashboard").then((mod) => ({ default: mod.ComplianceDashboard })),
  {
    loading: () => <LoadingSpinner />,
    ssr: true,
  }
)

export const metadata: Metadata = {
  title: "Usklađenost | FiskAI",
  description: "Pregled statusa fiskalizacije i usklađenosti s propisima",
}

export default async function CompliancePage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  // Fetch certificate status
  const certificate = await db.fiscalCertificate.findFirst({
    where: {
      companyId: company.id,
      status: "ACTIVE",
    },
    orderBy: {
      certNotAfter: "desc",
    },
  })

  const certificateStatus: CertificateStatus = certificate
    ? {
        status:
          new Date(certificate.certNotAfter) < new Date()
            ? "expired"
            : new Date(certificate.certNotAfter).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000
              ? "expiring"
              : "active",
        validUntil: certificate.certNotAfter,
        daysRemaining: Math.floor(
          (new Date(certificate.certNotAfter).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        ),
      }
    : {
        status: "missing",
        validUntil: null,
        daysRemaining: 0,
      }

  // Fetch business premises count
  const premisesCount = await db.businessPremises.count({
    where: {
      companyId: company.id,
      isActive: true,
    },
  })

  // Fetch fiscalization stats
  const totalFiscalized = await db.fiscalRequest.count({
    where: {
      companyId: company.id,
      status: "COMPLETED",
      jir: {
        not: null,
      },
    },
  })

  const successfulRequests = await db.fiscalRequest.count({
    where: {
      companyId: company.id,
      status: "COMPLETED",
      jir: {
        not: null,
      },
    },
  })

  const lastSync = await db.fiscalRequest.findFirst({
    where: {
      companyId: company.id,
      status: "COMPLETED",
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      updatedAt: true,
    },
  })

  const fiscalizationStats: FiscalizationStats = {
    total: totalFiscalized,
    success: successfulRequests,
    lastSync: lastSync?.updatedAt || null,
  }

  const accountingPeriods = await db.accountingPeriod.findMany({
    where: { companyId: company.id },
    orderBy: { startDate: "desc" },
    take: 3,
  })

  const latestPeriod = accountingPeriods[0]
  if (latestPeriod) {
    await ensureReportingStatuses({
      companyId: company.id,
      periodId: latestPeriod.id,
      actorId: user.id!,
      reason: "compliance_dashboard_bootstrap",
    })
  }

  const reportingStatuses = latestPeriod
    ? await db.reportingStatus.findMany({
        where: { companyId: company.id, periodId: latestPeriod.id },
        orderBy: { reportType: "asc" },
        include: { reviewQueueItem: { select: { status: true } } },
      })
    : []

  // Fetch recent fiscalized invoices
  const recentInvoices = await db.eInvoice.findMany({
    where: {
      companyId: company.id,
      jir: {
        not: null,
      },
      fiscalizedAt: {
        not: null,
      },
    },
    orderBy: {
      fiscalizedAt: "desc",
    },
    take: 10,
    select: {
      id: true,
      invoiceNumber: true,
      issueDate: true,
      totalAmount: true,
      jir: true,
      zki: true,
      fiscalizedAt: true,
      buyer: {
        select: {
          name: true,
        },
      },
    },
  })

  const complianceData: ComplianceData = {
    certificateStatus,
    fiscalizationStats,
    premisesCount,
    recentInvoices: recentInvoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      issueDate: inv.issueDate,
      totalAmount: inv.totalAmount.toNumber(),
      jir: inv.jir!,
      zki: inv.zki || null,
      fiscalizedAt: inv.fiscalizedAt!,
      buyerName: inv.buyer?.name || "Nepoznato",
    })),
    reportingStatuses: reportingStatuses.map(
      (status): ReportingStatusSummary => ({
        id: status.id,
        reportType: status.reportType,
        status: status.status,
        updatedAt: status.updatedAt,
        reviewStatus: status.reviewQueueItem?.status ?? null,
      })
    ),
    accountingPeriods: accountingPeriods.map(
      (period): AccountingPeriodSummary => ({
        id: period.id,
        startDate: period.startDate,
        endDate: period.endDate,
        status: period.status,
        lockedAt: period.lockedAt,
        lockReason: period.lockReason,
      })
    ),
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-brand-600">Kontrolni centar</p>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Usklađenost</h1>
        <p className="text-sm text-[var(--muted)]">
          Pregled statusa fiskalizacije, certifikata i obveza
        </p>
      </div>

      <ComplianceDashboard data={complianceData} company={company} />
    </div>
  )
}
