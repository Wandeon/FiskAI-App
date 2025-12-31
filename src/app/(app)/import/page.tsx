import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import { ImportClient } from "./import-client"

export default async function ImportPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  // Get bank accounts for the selector
  const bankAccounts = await db.bankAccount.findMany({
    where: { companyId: company.id },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      iban: true,
    },
  })

  // Get any pending/in-progress jobs to restore queue state
  const pendingJobs = await db.importJob.findMany({
    where: {
      companyId: company.id,
      status: { in: ["PENDING", "PROCESSING", "READY_FOR_REVIEW"] },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      originalName: true,
      status: true,
      documentType: true,
      extractedData: true,
      failureReason: true,
      pagesProcessed: true,
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Uvoz dokumenata</h1>
        <p className="text-tertiary">Uvezite bankovne izvode, račune i druge dokumente</p>
      </div>

      <ImportClient
        bankAccounts={bankAccounts}
        initialJobs={pendingJobs.map((j) => ({
          id: j.id,
          fileName: j.originalName,
          status: j.status as any,
          documentType: j.documentType,
          progress: j.status === "READY_FOR_REVIEW" ? 100 : j.status === "PROCESSING" ? 50 : 0,
          error: j.failureReason,
          extractedData: j.extractedData as any,
        }))}
      />
    </div>
  )
}
