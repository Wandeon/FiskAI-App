import { NextResponse } from "next/server"
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

  bankingLogger.warn(
    { jobId: job.id, userId: user.id },
    "Rejected bank import deletion attempt: imports are immutable"
  )

  return NextResponse.json(
    { error: "Bankovni uvozi su nepromjenjivi i nije ih moguće obrisati." },
    { status: 405 }
  )
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

  await request.json().catch(() => null)
  bankingLogger.warn(
    { jobId, userId: user.id },
    "Rejected bank import mutation attempt: imports are immutable"
  )

  return NextResponse.json(
    { error: "Bankovni uvozi su nepromjenjivi i nije ih moguće uređivati." },
    { status: 405 }
  )
}
