import { NextResponse } from 'next/server'
import { requireAuth, requireCompany } from '@/lib/auth-utils'
import { db } from '@/lib/db'
import { setTenantContext } from '@/lib/prisma-extensions'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const { id } = await params

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const job = await db.importJob.findUnique({
    where: { id },
    include: {
      bankAccount: {
        select: { id: true, name: true, iban: true },
      },
    },
  })

  if (!job || job.companyId !== company.id) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    job: {
      id: job.id,
      status: job.status,
      documentType: job.documentType,
      fileName: job.originalName,
      extractedData: job.extractedData,
      bankAccount: job.bankAccount,
      failureReason: job.failureReason,
      pagesProcessed: job.pagesProcessed,
      tierUsed: job.tierUsed,
      createdAt: job.createdAt,
    },
  })
}
