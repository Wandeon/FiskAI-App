import { NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { setTenantContext } from "@/lib/prisma-extensions"
import { db } from "@/lib/db"
import { JobStatus } from "@prisma/client"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const body = await request.json()
  const status = body.status as JobStatus
  if (!status) {
    return NextResponse.json({ error: "Missing status" }, { status: 400 })
  }

  // Verify job ownership - SECURITY: Prevent IDOR vulnerability
  const job = await db.importJob.findFirst({
    where: {
      id: jobId,
      companyId: company.id
    }
  })

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  await db.importJob.update({
    where: { id: job.id },
    data: { status },
  })

  return NextResponse.json({ success: true })
}
