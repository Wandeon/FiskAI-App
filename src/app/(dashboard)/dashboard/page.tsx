import { requireAuth, getCurrentCompany } from "@/lib/auth-utils"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist"
import { AlertBanner } from "@/components/dashboard/alert-banner"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { QuickStats } from "@/components/dashboard/quick-stats"
import { FiscalizationStatus } from "@/components/dashboard/fiscalization-status"

const Decimal = Prisma.Decimal

export default async function DashboardPage() {
  const user = await requireAuth()
  const company = await getCurrentCompany(user.id!)

  if (!company) {
    redirect("/onboarding")
  }

  // Get counts and financial data
  const [
    eInvoiceCount,
    contactCount,
    productCount,
    draftInvoices,
    recentInvoices,
    totalRevenue,
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
  ])

  const totalRevenueValue = Number(totalRevenue._sum.totalAmount || new Decimal(0))

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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Dobrodošli, {firstName}!
        </h1>
        <p className="text-[var(--muted)] mt-1">{company.name}</p>
      </div>

      {/* Alerts */}
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

      {/* Onboarding Checklist */}
      <OnboardingChecklist items={onboardingItems} />

      {/* Quick Stats */}
      <QuickStats
        totalRevenue={totalRevenueValue}
        eInvoiceCount={eInvoiceCount}
        contactCount={contactCount}
        productCount={productCount}
        draftCount={draftInvoices}
      />

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentActivity invoices={recentInvoices} />
        <FiscalizationStatus
          isVatPayer={company.isVatPayer}
          eInvoiceProvider={company.eInvoiceProvider}
          oib={company.oib}
          vatNumber={company.vatNumber}
        />
      </div>
    </div>
  )
}
