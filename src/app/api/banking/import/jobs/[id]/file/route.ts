import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import mime from "mime-types"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { setTenantContext } from "@/lib/prisma-extensions"
import { db } from "@/lib/db"
import { downloadFromR2 } from "@/lib/r2-client"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireAuth()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const company = await requireCompany(user.id!)
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 })

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const job = await db.importJob.findUnique({ where: { id } })
  if (!job || job.companyId !== company.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    // Retrieve file from R2 storage (new) or local filesystem (legacy)
    let data: Buffer
    let contentType: string

    if (job.storageKey) {
      // New: R2 storage
      data = await downloadFromR2(job.storageKey)
      const ext = path.extname(job.originalName)
      contentType = mime.lookup(ext) || "application/octet-stream"
    } else if (job.storagePath) {
      // Legacy: local filesystem
      const exists = await fs
        .access(job.storagePath)
        .then(() => true)
        .catch(() => false)

      if (!exists) {
        return NextResponse.json({ error: "File missing" }, { status: 404 })
      }

      data = await fs.readFile(job.storagePath)
      contentType = mime.lookup(path.extname(job.storagePath)) || "application/octet-stream"
    } else {
      return NextResponse.json({ error: "File missing" }, { status: 404 })
    }

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${job.originalName}"`,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }
}
