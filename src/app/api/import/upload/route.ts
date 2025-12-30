import { NextResponse } from "next/server"
import { createHash } from "crypto"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import { detectDocumentType } from "@/lib/import/detect-document-type"
import { DocumentType } from "@prisma/client"
import { uploadToR2, generateR2Key } from "@/lib/r2-client"

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
const ALLOWED_EXTENSIONS = ["pdf", "xml", "csv", "jpg", "jpeg", "png", "heic", "webp"]

export async function POST(request: Request) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const formData = await request.formData()
  const file = formData.get("file")
  const bankAccountId = formData.get("bankAccountId") as string | null
  const documentTypeOverride = formData.get("documentType") as string | null

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 })
  }

  const fileName = (file as File).name || "upload"
  const extension = fileName.split(".").pop()?.toLowerCase() || ""

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return NextResponse.json(
      {
        error: `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
      },
      { status: 400 }
    )
  }

  const arrayBuffer = await file.arrayBuffer()
  if (arrayBuffer.byteLength === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 })
  }
  if (arrayBuffer.byteLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 413 })
  }

  const buffer = Buffer.from(arrayBuffer)
  const checksum = createHash("sha256").update(buffer).digest("hex")

  // Upload file to R2 storage
  const key = generateR2Key(company.id, checksum, fileName)
  await uploadToR2(key, buffer, file.type)

  // Detect document type
  const detection = detectDocumentType(fileName, file.type)
  const documentType = (documentTypeOverride as DocumentType | null) || detection.type

  // Create import job
  const job = await db.importJob.create({
    data: {
      companyId: company.id,
      userId: user.id!,
      bankAccountId: bankAccountId || null,
      fileChecksum: checksum,
      originalName: fileName,
      storageKey: key,
      status: "PENDING",
      documentType,
    },
  })

  // Trigger background processing - use localhost in development to avoid DNS/port issues
  const isDev = process.env.NODE_ENV !== "production"
  const baseUrl = isDev
    ? `http://localhost:${process.env.PORT || 3000}`
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  fetch(`${baseUrl}/api/import/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId: job.id }),
  }).catch((err) => console.error("Failed to trigger processing:", err))

  return NextResponse.json({
    success: true,
    jobId: job.id,
    status: job.status,
    documentType,
    detectionConfidence: detection.confidence,
  })
}
