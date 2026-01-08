import { LegacyBanner } from "@/components/layout/LegacyBanner"
import { requireAuth, getCurrentCompany, isOnboardingComplete } from "@/lib/auth-utils"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Prisma, EInvoiceStatus } from "@prisma/client"
import { TrendingUp, FileText, Users, Package } from "lucide-react"
import { HeroBanner } from "@/components/dashboard/hero-banner"
import { RevenueTrendCard } from "@/components/dashboard/revenue-trend-card"
import { ActionCards } from "@/components/dashboard/action-cards"
import { FiscalizationStatus } from "@/components/dashboard/fiscalization-status"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { TodayActionsCard } from "@/components/dashboard/today-actions-card"
import { VatOverviewCard } from "@/components/dashboard/vat-overview-card"
import { InvoiceFunnelCard } from "@/components/dashboard/invoice-funnel-card"
import { InsightsCard } from "@/components/dashboard/insights-card"
import { PausalniStatusCard } from "@/components/dashboard/pausalni-status-card"
import { DeadlineCountdownCard } from "@/components/dashboard/deadline-countdown-card"
import { getUpcomingDeadlines } from "@/lib/deadlines/queries"
import { ChecklistWidget, InsightsWidget } from "@/components/guidance"
import { Visible } from "@/lib/visibility"
import { TutorialProgressWidget } from "@/components/tutorials/tutorial-progress-widget"
import { ContextualHelpBanner } from "@/components/tutorials/contextual-help-banner"
import { getTrackForLegalForm } from "@/lib/tutorials/tracks"
import { getTutorialProgress } from "@/lib/tutorials/progress"
import { getActiveTriggersForContext } from "@/lib/tutorials/triggers"
import { ComplianceStatusCard } from "@/components/dashboard/compliance-status-card"
import { getCertificateStatus, getFiscalizationStats } from "@/lib/compliance/data"
import { deriveCapabilities } from "@/lib/capabilities"

const Decimal = Prisma.Decimal

const revenueStatuses: EInvoiceStatus[] = ["FISCALIZED", "SENT", "DELIVERED", "ACCEPTED"]

export default async function DashboardPage() {
  const user = await requireAuth()
  const company = await getCurrentCompany(user.id!)
  const capabilities = deriveCapabilities(company)

  // Redirect to onboarding if no company or if onboarding is incomplete
  // This prevents redirect loop when company exists but has missing required fields
  if (!company || !isOnboardingComplete(company)) {
    redirect("/onboarding")
  }

  // Get counts and financial data
  const monthsWindow = 6
  const trendStart = new Date()
  trendStart.setMonth(trendStart.getMonth() - (monthsWindow - 1))
  trendStart.setDate(1)

  const [
    eInvoiceCount,
    contactCount,
    productCount,
    draftInvoices,
    recentInvoices,
    totalRevenue,
    revenueTrendRaw,
    statusBuckets,
    ytdRevenue,
    expenseCount,
    lastBankImport,
  ] = await Promise.all([
    db.eInvoice.count({ where: { companyId: company.id } }),
    db.contact.count({ where: { companyId: company.id } }),
    db.product.count({ where: { companyId: company.id } }),
    db.eInvoice.count({
      where: { companyId: company.id, status: "DRAFT" },
    }),
    db.eInvoice.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        buyer: { select: { name: true } },
      },
    }),
    db.eInvoice.aggregate({
      where: {
        companyId: company.id,
        status: { in: ["FISCALIZED", "SENT", "DELIVERED", "ACCEPTED"] },
      },
      _sum: { totalAmount: true },
    }),
    db.eInvoice.findMany({
      where: {
        companyId: company.id,
        status: { in: revenueStatuses },
        createdAt: { gte: trendStart },
      },
      select: {
        createdAt: true,
        totalAmount: true,
      },
    }),
    db.eInvoice.groupBy({
      by: ["status"],
      where: { companyId: company.id },
      _count: { id: true },
      _sum: { vatAmount: true },
    }),
    db.eInvoice.aggregate({
      where: {
        companyId: company.id,
        status: { in: revenueStatuses },
        createdAt: {
          gte: new Date(new Date().getFullYear(), 0, 1), // Jan 1 of current year
        },
      },
      _sum: { totalAmount: true },
    }),
    db.expense.count({ where: { companyId: company.id } }),
    db.statementImport
      .findFirst({
        where: { companyId: company.id },
        orderBy: { importedAt: "desc" },
        select: { importedAt: true },
      })
      .then((result) => result?.importedAt),
  ])

  const totalRevenueValue = Number(totalRevenue._sum.totalAmount || new Decimal(0))

  // Get tutorial track and progress for all business types
  const tutorialTrack = company.legalForm ? getTrackForLegalForm(company.legalForm) : null

  const tutorialProgress =
    tutorialTrack && user.id
      ? await getTutorialProgress(user.id, company.id, tutorialTrack.id)
      : null

  // Get contextual triggers
  const triggers = await getActiveTriggersForContext({
    companyId: company.id,
    invoiceCount: eInvoiceCount,
    yearlyRevenue: Number(ytdRevenue._sum.totalAmount || 0),
    hasFiscalCert: !!company.fiscalEnabled,
    legalForm: company.legalForm,
    expenseCount,
    contactCount,
    lastBankImport: lastBankImport || undefined,
  })

  // Get compliance status for fiscalization-enabled companies
  const [certificateStatus, fiscalizationStats] =
    company.fiscalEnabled && capabilities.modules.fiscalization?.enabled
      ? await Promise.all([getCertificateStatus(company.id), getFiscalizationStats(company.id)])
      : [null, null]

  // Map legalForm to businessType for deadlines
  const businessTypeMap: Record<string, string> = {
    OBRT_PAUSAL: "pausalni",
    OBRT_REAL: "obrt",
    OBRT_VAT: "obrt",
    JDOO: "doo",
    DOO: "doo",
  }
  const businessType = businessTypeMap[company.legalForm || ""] || "all"

  // Fetch upcoming deadlines
  const upcomingDeadlines = await getUpcomingDeadlines(30, businessType, 5)

  // Calculate next deadline for paušalni
  const nextDeadline =
    upcomingDeadlines.length > 0
      ? {
          title: upcomingDeadlines[0].title,
          date: new Date(upcomingDeadlines[0].deadlineDate),
          daysLeft: Math.ceil(
            (new Date(upcomingDeadlines[0].deadlineDate).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24)
          ),
          type: upcomingDeadlines[0].deadlineType?.includes("posd")
            ? ("posd" as const)
            : ("doprinosi" as const),
        }
      : null

  const trendBuckets = Array.from({ length: monthsWindow }).map((_, index) => {
    const date = new Date()
    date.setMonth(date.getMonth() - (monthsWindow - index - 1))
    date.setDate(1)
    return {
      key: `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`,
      label: date.toLocaleString("hr-HR", { month: "short" }),
    }
  })

  const revenueTrendData = trendBuckets.map((bucket) => {
    const monthlyTotal = revenueTrendRaw.reduce((sum, invoice) => {
      const invoiceKey = `${invoice.createdAt.getFullYear()}-${(invoice.createdAt.getMonth() + 1)
        .toString()
        .padStart(2, "0")}`
      if (invoiceKey === bucket.key) {
        return sum + Number(invoice.totalAmount || 0)
      }
      return sum
    }, 0)
    return { label: bucket.label, value: monthlyTotal }
  })

  // Onboarding checklist items
  const onboardingItems = [
    {
      id: "company",
      label: "Podaci o tvrtki",
      description: "Dodajte OIB, adresu i kontakt podatke",
      href: "/settings",
      completed: !!company.oib && !!company.address,
    },
    {
      id: "provider",
      label: "Konfigurirajte posrednika",
      description: "Povežite se s IE-Računi ili drugim posrednikom",
      href: "/settings",
      completed: !!company.eInvoiceProvider,
    },
    {
      id: "contact",
      label: "Dodajte prvi kontakt",
      description: "Kreirajte kupca ili dobavljača",
      href: "/contacts/new",
      completed: contactCount > 0,
    },
    {
      id: "product",
      label: "Dodajte proizvod ili uslugu",
      description: "Kreirajte artikl za fakturiranje",
      href: "/products/new",
      completed: productCount > 0,
    },
    {
      id: "invoice",
      label: "Kreirajte prvi e-račun",
      description: "Izdajte i fiskalizirajte račun",
      href: "/e-invoices/new",
      completed: eInvoiceCount > 0,
    },
  ]

  const firstName = user.name?.split(" ")[0] || user.email?.split("@")[0] || "korisniče"

  const getStatusAggregate = (status: EInvoiceStatus) =>
    statusBuckets.find((bucket) => bucket.status === status)

  const sumVatForStatuses = (statuses: EInvoiceStatus[]) =>
    statuses.reduce((sum, status) => {
      const bucket = getStatusAggregate(status)
      return sum + Number(bucket?._sum.vatAmount || 0)
    }, 0)

  const vatPaid = sumVatForStatuses(["FISCALIZED", "DELIVERED", "ACCEPTED"])
  const vatPending = sumVatForStatuses(["PENDING_FISCALIZATION", "SENT"])

  const statusCount = (status: EInvoiceStatus) => Number(getStatusAggregate(status)?._count.id || 0)

  const funnelStages = [
    { label: "Nacrti", value: statusCount("DRAFT") },
    { label: "Slanje", value: statusCount("SENT") + statusCount("PENDING_FISCALIZATION") },
    { label: "Dostavljeno", value: statusCount("DELIVERED") },
    { label: "Prihvaćeno", value: statusCount("ACCEPTED") },
  ]

  const alerts = [
    !company.eInvoiceProvider && {
      id: "provider",
      type: "warning" as const,
      title: "Povežite informacijskog posrednika",
      description: "Bez posrednika ne možete slati e-račune.",
      action: { label: "Postavke", href: "/settings" },
    },
    draftInvoices > 0 && {
      id: "drafts",
      type: "info" as const,
      title: `${draftInvoices} e-račun${draftInvoices === 1 ? "" : "a"} čeka slanje`,
      description: "Dovršite nacrte i pošaljite kupcima.",
      action: { label: "Pregledaj", href: "/e-invoices?status=DRAFT" },
    },
  ].filter(Boolean) as {
    id: string
    type: "warning" | "info"
    title: string
    description: string
    action?: { label: string; href: string }
  }[]

  const statHighlights = [
    {
      id: "revenue",
      label: "Ukupni prihod",
      value: `${totalRevenueValue.toLocaleString("hr-HR", { minimumFractionDigits: 2 })} €`,
      icon: <TrendingUp className="h-4 w-4" />,
      change: `Zadnjih ${monthsWindow} mjeseci`,
    },
    {
      id: "einvoices",
      label: "E-Računi",
      value: eInvoiceCount.toString(),
      icon: <FileText className="h-4 w-4" />,
      change: draftInvoices > 0 ? `${draftInvoices} u nacrtu` : undefined,
    },
    {
      id: "contacts",
      label: "Kontakti",
      value: contactCount.toString(),
      icon: <Users className="h-4 w-4" />,
    },
    {
      id: "products",
      label: "Proizvodi",
      value: productCount.toString(),
      icon: <Package className="h-4 w-4" />,
    },
  ]

  const upcomingTasks = onboardingItems
    .filter((item) => !item.completed)
    .map((item) => ({
      id: item.id,
      label: item.label,
      href: item.href,
      completed: item.completed,
    }))

  return (
    <div className="space-y-6">
      <LegacyBanner message="View-only. Use Control Center for actions." />
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <Visible id="card:hero-banner">
            <HeroBanner
              userName={firstName}
              companyName={company.name}
              legalForm={company.legalForm}
              draftInvoices={draftInvoices}
              providerConfigured={!!company.eInvoiceProvider}
              contactCount={contactCount}
            />
          </Visible>

          {/* Contextual Help */}
          {triggers.length > 0 && <ContextualHelpBanner triggers={triggers} />}

          {/* Tutorial Progress Widget */}
          {tutorialTrack && (
            <TutorialProgressWidget track={tutorialTrack} progress={tutorialProgress} />
          )}

          <Visible id="card:checklist-widget">
            <ChecklistWidget />
          </Visible>

          <Visible id="card:insights-widget">
            <InsightsWidget />
          </Visible>

          <Visible id="card:today-actions">
            <TodayActionsCard alerts={alerts} stats={statHighlights} tasks={upcomingTasks} />
          </Visible>
          <Visible id="card:revenue-trend">
            <RevenueTrendCard data={revenueTrendData} />
          </Visible>
        </div>
        <div className="space-y-6">
          {capabilities.modules.fiscalization?.enabled && (
            <Visible id="card:fiscalization-status">
              <FiscalizationStatus
                isVatPayer={company.isVatPayer}
                eInvoiceProvider={company.eInvoiceProvider}
                oib={company.oib}
                vatNumber={company.vatNumber}
              />
            </Visible>
          )}

          {capabilities.modules.fiscalization?.enabled &&
            certificateStatus &&
            fiscalizationStats && (
              <Visible id="card:fiscalization-status">
                <ComplianceStatusCard certificate={certificateStatus} stats={fiscalizationStats} />
              </Visible>
            )}

          {company.legalForm === "OBRT_PAUSAL" && (
            <Visible id="card:pausalni-status">
              <PausalniStatusCard
                ytdRevenue={Number(ytdRevenue._sum.totalAmount || 0)}
                vatThreshold={60000}
                nextDeadline={nextDeadline}
                quarterlyIncome={{ q1: 0, q2: 0, q3: 0, q4: 0 }}
              />
            </Visible>
          )}

          <Visible id="card:deadline-countdown">
            <DeadlineCountdownCard deadlines={upcomingDeadlines} businessType={businessType} />
          </Visible>
          <Visible id="card:vat-overview">
            <VatOverviewCard
              paidVat={vatPaid}
              pendingVat={vatPending}
              isVatPayer={company.isVatPayer}
            />
          </Visible>
          <Visible id="card:invoice-funnel">
            <InvoiceFunnelCard stages={funnelStages} />
          </Visible>
          <Visible id="card:insights">
            <InsightsCard
              companyName={company.name}
              isVatPayer={company.isVatPayer}
              contactCount={contactCount}
              productCount={productCount}
            />
          </Visible>
          <Visible id="card:recent-activity">
            <RecentActivity invoices={recentInvoices} />
          </Visible>
          <ActionCards />
        </div>
      </div>
    </div>
  )
}
