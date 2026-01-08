// src/app/(dashboard)/settings/fiscalisation/page.tsx
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { CertificateCard } from "./certificate-card"
import { FiscalStatusPanel } from "./fiscal-status-panel"
import { deriveCapabilities } from "@/lib/capabilities"
import { redirect } from "next/navigation"

export default async function FiscalisationSettingsPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const capabilities = deriveCapabilities(company)

  if (!capabilities.modules.fiscalization?.enabled) {
    redirect("/settings?tab=plan&blocked=fiscalization")
  }

  const [testCert, prodCert, recentRequests, stats] = await Promise.all([
    db.fiscalCertificate.findUnique({
      where: { companyId_environment: { companyId: company.id, environment: "TEST" } },
    }),
    db.fiscalCertificate.findUnique({
      where: { companyId_environment: { companyId: company.id, environment: "PROD" } },
    }),
    db.fiscalRequest.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { invoice: { select: { invoiceNumber: true } } },
    }),
    db.fiscalRequest.groupBy({
      by: ["status"],
      where: { companyId: company.id },
      _count: true,
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Fiscalisation Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage certificates and monitor fiscalisation status
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CertificateCard environment="TEST" certificate={testCert} companyOib={company.oib} />
        <CertificateCard environment="PROD" certificate={prodCert} companyOib={company.oib} />
      </div>

      <FiscalStatusPanel requests={recentRequests} stats={stats} />
    </div>
  )
}
