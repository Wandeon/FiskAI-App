import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import { createHash } from "crypto"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { downloadFromR2 } from "@/lib/r2-client"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const { id } = await params

  const job = await db.importJob.findUnique({ where: { id } })

  if (!job || job.companyId !== company.id) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  try {
    // Retrieve file from R2 storage (new) or local filesystem (legacy)
    const fileBuffer = job.storageKey
      ? await downloadFromR2(job.storageKey)
      : await fs.readFile(job.storagePath!)

    // Verify file integrity using stored checksum
    if (job.fileChecksum) {
      const currentHash = createHash("sha256").update(fileBuffer).digest("hex")
      if (currentHash !== job.fileChecksum) {
        logger.error(
          {
            jobId: job.id,
            expected: job.fileChecksum,
            actual: currentHash,
          },
          "File integrity check failed"
        )
        return NextResponse.json(
          { error: "File integrity verification failed" },
          { status: 500 }
        )
      }
    }

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
        ...(job.fileChecksum && {
          "Content-MD5": Buffer.from(job.fileChecksum, "hex").toString("base64"),
          "X-Content-SHA256": job.fileChecksum,
        }),
      },
    })
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }
}
