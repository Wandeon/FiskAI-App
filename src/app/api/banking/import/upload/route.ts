import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { createHash } from "crypto"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import { Prisma } from "@prisma/client"
import { bankingLogger } from "@/lib/logger"

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024 // 20MB safety cap
const ALLOWED_EXTENSIONS = ["pdf", "xml"]

export async function POST(request: Request) {
  // For testing, allow first company without auth
  let company, userId

  try {
    const user = await requireAuth()
    if (user) {
      userId = user.id!
      const userCompany = await requireCompany(userId)
      if (!userCompany) {
        return NextResponse.json({ error: "Company not found" }, { status: 404 })
      }
      company = userCompany
    } else {
      // Fallback for testing: get first company
      company = await db.company.findFirst()
      if (!company) {
        return NextResponse.json({ error: "No company found" }, { status: 404 })
      }
      userId = "test-user-" + Date.now()
    }
  } catch (authError) {
    // If auth fails, try first company for testing
    bankingLogger.warn({ error: authError }, "Auth failed, using test mode for bank import upload")
    company = await db.company.findFirst()
    if (!company) {
      return NextResponse.json({ error: "No company found" }, { status: 404 })
    }
    userId = "test-user-" + Date.now()
  }

  setTenantContext({
    companyId: company.id,
    userId: userId,
  })

  const formData = await request.formData()
  const file = formData.get("file")
  const accountId = formData.get("accountId") as string | null
  const overwrite = (formData.get("overwrite") as string) === "true"

  if (!(file instanceof Blob) || !accountId) {
    return NextResponse.json({ error: "Missing file or account" }, { status: 400 })
  }

  const account = await db.bankAccount.findUnique({ where: { id: accountId } })
  if (!account || account.companyId !== company.id) {
    return NextResponse.json({ error: "Invalid bank account" }, { status: 400 })
  }

  const fileName = (file as File).name || "upload"
  const extension = fileName.split(".").pop()?.toLowerCase() || ""
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return NextResponse.json({ error: "Only PDF or XML files are supported" }, { status: 400 })
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

  const storageDir = path.join(process.cwd(), "uploads", "bank-statements")
  await fs.mkdir(storageDir, { recursive: true })
  const storedFileName = `${checksum}.${extension}`
  const storagePath = path.join(storageDir, storedFileName)

  // Detect duplicate for this bank account by checksum
  const existingJob = await db.importJob.findFirst({
    where: {
      bankAccountId: accountId,
      fileChecksum: checksum,
    },
  })

  if (existingJob && !overwrite) {
    return NextResponse.json(
      {
        success: false,
        requiresOverwrite: true,
        existingJobId: existingJob.id,
        message: "Izvod s istim sadržajem već postoji. Prepiši?",
      },
      { status: 409 }
    )
  }

  // Overwrite flow: delete existing job + file before writing new file
  if (existingJob && overwrite) {
    try {
      await db.importJob.delete({ where: { id: existingJob.id } })
      bankingLogger.info(
        { jobId: existingJob.id, accountId },
        "Deleted previous import job for overwrite"
      )
    } catch (error) {
      bankingLogger.error(
        { error, jobId: existingJob.id, accountId },
        "Failed to delete previous import job during overwrite - data integrity may be compromised"
      )
      return NextResponse.json(
        { error: "Failed to overwrite previous import. Please try again or contact support." },
        { status: 500 }
      )
    }
    if (existingJob.storagePath) {
      try {
        await fs.unlink(existingJob.storagePath)
        bankingLogger.info(
          { path: existingJob.storagePath, jobId: existingJob.id },
          "Deleted previous statement file for overwrite"
        )
      } catch (error) {
        // Log error but continue - orphaned file is less critical than blocking upload
        // A cleanup job should handle orphaned files periodically
        bankingLogger.warn(
          { error, path: existingJob.storagePath, jobId: existingJob.id },
          "Failed to delete old statement file - orphaned file may remain on disk"
        )
      }
    }
  }

  await fs.writeFile(storagePath, buffer)

  try {
    const job = await db.importJob.create({
      data: {
        companyId: company.id,
        userId: userId,
        bankAccountId: accountId,
        fileChecksum: checksum,
        originalName: fileName,
        storagePath,
        status: "PENDING",
        tierUsed: extension === "xml" ? "XML" : null,
      },
    })

    bankingLogger.info(
      { jobId: job.id, accountId, fileName, checksum },
      "Bank statement upload successful"
    )

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: job.status,
      tierUsed: job.tierUsed,
      message: "Upload received. Processing will continue in the background.",
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      bankingLogger.warn(
        { error, accountId, checksum },
        "Duplicate statement upload attempt detected (checksum match)"
      )
      return NextResponse.json(
        { error: "This statement was already uploaded for this account (checksum match)." },
        { status: 409 }
      )
    }
    bankingLogger.error({ error, accountId, fileName }, "Failed to create import job")
    return NextResponse.json({ error: "Failed to create import job" }, { status: 500 })
  }
}
