import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import { createHash } from "crypto"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const { id } = await params

  const job = await db.importJob.findUnique({ where: { id } })

  if (!job || job.companyId !== company.id) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  try {
    const fileBuffer = await fs.readFile(job.storagePath)
    const ext = job.originalName.split(".").pop()?.toLowerCase() || ""

    const mimeTypes: Record<string, string> = {
      pdf: "application/pdf",
      xml: "application/xml",
      csv: "text/csv",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      heic: "image/heic",
      webp: "image/webp",
    }

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": mimeTypes[ext] || "application/octet-stream",
        "Content-Disposition": `inline; filename="${job.originalName}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }
}
