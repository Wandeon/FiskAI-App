import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import mime from "mime-types"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { setTenantContext } from "@/lib/prisma-extensions"
import { db } from "@/lib/db"

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

  const filePath = job.storagePath
  if (!filePath) {
    return NextResponse.json({ error: "File missing" }, { status: 404 })
  }

  const exists = await fs
    .access(filePath)
    .then(() => true)
    .catch(() => false)
  if (!exists) {
    return NextResponse.json({ error: "File missing" }, { status: 404 })
  }

  const data = await fs.readFile(filePath)
  const contentType = mime.lookup(path.extname(filePath)) || "application/octet-stream"

  return new NextResponse(data, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${job.originalName}"`,
    },
  })
}
