import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DocumentDetail } from "./ui/document-detail"
import { deriveCapabilities } from "@/lib/capabilities"

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const capabilities = deriveCapabilities(company)

  if (!capabilities.modules.banking?.enabled) {
    redirect("/settings?tab=plan&blocked=banking")
  }

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const job = await db.importJob.findUnique({
    where: { id },
    include: {
      statement: {
        include: {
          pages: {
            orderBy: { pageNumber: "asc" },
          },
          transactions: true,
        },
      },
      bankAccount: { select: { name: true, iban: true } },
    },
  })

  if (!job || job.companyId !== company.id) {
    notFound()
  }

  const statement = job.statement

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{job.originalName}</h1>
          <p className="text-sm text-secondary">
            {job.bankAccount && (
              <>
                Račun: {job.bankAccount.name} ({job.bankAccount.iban}) ·{" "}
              </>
            )}
            Status: {job.status}
          </p>
        </div>
        <Link href="/banking/documents">
          <Button variant="outline">Natrag</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <DocumentDetail job={job} statement={statement || null} />
        </CardContent>
      </Card>
    </div>
  )
}
