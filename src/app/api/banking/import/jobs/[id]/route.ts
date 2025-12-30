import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { setTenantContext } from "@/lib/prisma-extensions"
import { db } from "@/lib/db"
import { bankingLogger } from "@/lib/logger"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const company = await requireCompany(user.id!)
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 })
  }

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const jobId = id
  if (!jobId) {
    return NextResponse.json({ error: "Missing job id" }, { status: 400 })
  }

  const job = await db.importJob.findUnique({
    where: { id: jobId },
    include: {
      statement: {
        include: {
          pages: {
            select: {
              id: true,
              pageNumber: true,
              status: true,
            },
          },
        },
      },
    },
  })

  if (!job || job.companyId !== company.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const pages = job.statement?.pages || []
  const pageCount = pages.length
  const pagesVerified = pages.filter((p) => p.status === "VERIFIED").length
  const pagesNeedsVision = pages.filter((p) => p.status === "NEEDS_VISION").length
  const pagesFailed = pages.filter((p) => p.status === "FAILED").length

  return NextResponse.json({
    success: true,
    job: {
      id: job.id,
      status: job.status,
      tierUsed: job.tierUsed,
      failureReason: job.failureReason,
      pagesProcessed: job.pagesProcessed,
      pagesFailed: job.pagesFailed,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      statementId: job.statement?.id ?? null,
      pageCount,
      pagesVerified,
      pagesNeedsVision,
    },
  })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const company = await requireCompany(user.id!)
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 })
  }

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const jobId = id
  if (!jobId) {
    return NextResponse.json({ error: "Missing job id" }, { status: 400 })
  }

  const job = await db.importJob.findUnique({
    where: { id: jobId },
    include: { statement: true },
  })

  if (!job || job.companyId !== company.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Delete file with proper error logging
  if (job.storagePath) {
    try {
      await import("fs").then((fs) => fs.promises.unlink(job.storagePath))
      bankingLogger.info(
        { jobId: job.id, path: job.storagePath },
        "Successfully deleted file for import job"
      )
    } catch (error) {
      // Log error but continue - orphaned file will be cleaned up by cron job
      // Don't fail the delete operation if file is missing or inaccessible
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        bankingLogger.warn(
          { jobId: job.id, path: job.storagePath },
          "File already deleted or missing during job deletion"
        )
      } else {
        bankingLogger.error(
          { error, jobId: job.id, path: job.storagePath },
          "Failed to delete file for import job - will be cleaned by cron job"
        )
      }
    }
  }

  await db.importJob.delete({ where: { id: jobId } })

  bankingLogger.info({ jobId: job.id }, "Import job deleted successfully")

  return NextResponse.json({ success: true })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const company = await requireCompany(user.id!)
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 })
  }

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const jobId = id
  if (!jobId) {
    return NextResponse.json({ error: "Missing job id" }, { status: 400 })
  }

  const payload = await request.json()
  const txs = Array.isArray(payload.transactions) ? payload.transactions : []

  for (const tx of txs) {
    if (!tx.id) continue
    await db.transaction.updateMany({
      where: { id: tx.id, companyId: company.id },
      data: {
        date: tx.date ? new Date(tx.date) : undefined,
        amount: tx.amount !== undefined ? new Prisma.Decimal(tx.amount) : undefined,
        description: tx.description ?? undefined,
        reference: tx.reference ?? undefined,
        payeeName: tx.payeeName ?? undefined,
        iban: tx.iban ?? undefined,
      },
    })
  }

  return NextResponse.json({ success: true })
}
