import { NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import { DocumentType, Prisma } from "@prisma/client"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const { id } = await params

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const body = await request.json()
  const { documentType } = body

  if (
    !documentType ||
    !["BANK_STATEMENT", "INVOICE", "EXPENSE", "PRIMKA", "IZDATNICA"].includes(documentType)
  ) {
    return NextResponse.json({ error: "Invalid document type" }, { status: 400 })
  }

  const job = await db.importJob.findFirst({
    where: { id, companyId: company.id },
  })

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  // Only allow type change for jobs that are ready for review or failed
  if (!["READY_FOR_REVIEW", "FAILED"].includes(job.status)) {
    return NextResponse.json({ error: "Cannot change type for this job status" }, { status: 400 })
  }

  // Update the document type
  const updated = await db.importJob.update({
    where: { id },
    data: { documentType: documentType as DocumentType },
  })

  // If the type changed and job was ready for review, we need to re-process
  const needsReprocess = job.documentType !== documentType && job.status === "READY_FOR_REVIEW"

  if (needsReprocess) {
    // Reset to pending and trigger reprocessing
    await db.importJob.update({
      where: { id },
      data: {
        status: "PENDING",
        extractedData: Prisma.JsonNull,
      },
    })

    // Trigger background processing
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`
    fetch(`${baseUrl}/api/import/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: id }),
    }).catch((err) => console.error("Failed to trigger reprocessing:", err))

    return NextResponse.json({
      success: true,
      jobId: id,
      documentType,
      reprocessing: true,
    })
  }

  return NextResponse.json({
    success: true,
    jobId: id,
    documentType: updated.documentType,
    reprocessing: false,
  })
}
