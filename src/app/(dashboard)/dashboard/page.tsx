import { requireAuth, getCurrentCompany } from "@/lib/auth-utils"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Prisma, EInvoiceStatus } from "@prisma/client"
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist"
import { AlertBanner } from "@/components/dashboard/alert-banner"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { QuickStats } from "@/components/dashboard/quick-stats"
import { FiscalizationStatus } from "@/components/dashboard/fiscalization-status"
import { HeroBanner } from "@/components/dashboard/hero-banner"
import { RevenueTrendCard } from "@/components/dashboard/revenue-trend-card"
import { ActionCards } from "@/components/dashboard/action-cards"

const Decimal = Prisma.Decimal

const revenueStatuses: EInvoiceStatus[] = ["FISCALIZED", "SENT", "DELIVERED", "ACCEPTED"]

export default async function DashboardPage() {
  const user = await requireAuth()
  const company = await getCurrentCompany(user.id!)

  if (!company) {
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
  ])

  const totalRevenueValue = Number(totalRevenue._sum.totalAmount || new Decimal(0))

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

  const firstName = user.name?.split(' ')[0] || user.email?.split('@')[0] || 'korisniče'

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <HeroBanner
          className="lg:col-span-2"
          userName={firstName}
          companyName={company.name}
          draftInvoices={draftInvoices}
          providerConfigured={!!company.eInvoiceProvider}
          contactCount={contactCount}
        />
        <OnboardingChecklist items={onboardingItems} className="h-full" />
      </div>

      <div className="space-y-3">
        {!company.eInvoiceProvider && (
          <AlertBanner
            type="error"
            title="E-računi nisu konfigurirani"
            description="Povežite se s posrednikom za slanje e-računa"
            action={{ label: "Konfiguriraj", href: "/settings" }}
          />
        )}
        {draftInvoices > 0 && (
          <AlertBanner
            type="warning"
            title={`${draftInvoices} ${draftInvoices === 1 ? 'račun' : draftInvoices < 5 ? 'računa' : 'računa'} u nacrtu`}
            description="Dovršite ih i pošaljite kupcima"
            action={{ label: "Pregledaj", href: "/e-invoices?status=DRAFT" }}
          />
        )}
      </div>

      <QuickStats
        totalRevenue={totalRevenueValue}
        eInvoiceCount={eInvoiceCount}
        contactCount={contactCount}
        productCount={productCount}
        draftCount={draftInvoices}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <RevenueTrendCard data={revenueTrendData} className="lg:col-span-2" />
        <FiscalizationStatus
          isVatPayer={company.isVatPayer}
          eInvoiceProvider={company.eInvoiceProvider}
          oib={company.oib}
          vatNumber={company.vatNumber}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentActivity invoices={recentInvoices} />
        <ActionCards />
      </div>
    </div>
  )
}
