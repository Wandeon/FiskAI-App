import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { db } from "@/lib/db"
import { promises as fs } from "fs"
import path from "path"
import { bankingLogger } from "@/lib/logger"
import { isValidationError, formatValidationError } from "@/lib/api/validation"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes for file operations

/**
 * Cleanup orphaned upload files
 *
 * This job runs periodically to:
 * 1. Find files in uploads/ directories that don't have a corresponding ImportJob record
 * 2. Find ImportJob records with FAILED status older than 30 days
 * 3. Move orphaned files to trash (recoverable for 30 days)
 * 4. Permanently delete files in trash older than 30 days
 */
export async function GET() {
  // Verify CRON_SECRET
  const headersList = await headers()
  const authHeader = headersList.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results = {
    orphanedFilesMoved: 0,
    failedJobsDeleted: 0,
    filesDeleted: 0,
    trashPurged: 0,
    errors: [] as string[],
  }

  try {
    const uploadsRoot = path.join(process.cwd(), "uploads")
    const trashDir = path.join(uploadsRoot, ".trash")

    // Ensure trash directory exists
    await fs.mkdir(trashDir, { recursive: true })

    // Step 1: Find and cleanup failed jobs older than 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const failedJobs = await db.importJob.findMany({
      where: {
        status: "FAILED",
        createdAt: { lt: thirtyDaysAgo },
      },
      select: {
        id: true,
        storagePath: true,
        originalName: true,
        createdAt: true,
      },
    })

    bankingLogger.info(
      { count: failedJobs.length, cutoffDate: thirtyDaysAgo },
      "Found failed import jobs older than 30 days for cleanup"
    )

    for (const job of failedJobs) {
      try {
        // Delete the file if it exists
        if (job.storagePath) {
          try {
            const fileName = path.basename(job.storagePath)
            const trashPath = path.join(trashDir, `${Date.now()}-${fileName}`)

            // Move to trash instead of immediate deletion (recoverable)
            await fs.rename(job.storagePath, trashPath)

            bankingLogger.info(
              {
                jobId: job.id,
                originalPath: job.storagePath,
                trashPath,
                fileName: job.originalName,
              },
              "Moved failed job file to trash"
            )
            results.orphanedFilesMoved++
          } catch (fileError) {
            // File might already be deleted, log but continue
            if ((fileError as NodeJS.ErrnoException).code !== "ENOENT") {
              bankingLogger.warn(
                {
                  error: fileError,
                  jobId: job.id,
                  path: job.storagePath,
                },
                "Failed to move file to trash for failed job"
              )
              results.errors.push(`Failed to move file for job ${job.id}`)
            }
          }
        }

        // Delete the job record
        await db.importJob.delete({ where: { id: job.id } })
        results.failedJobsDeleted++
      } catch (error) {
        bankingLogger.error({ error, jobId: job.id }, "Failed to cleanup failed import job")
        results.errors.push(`Failed to delete job ${job.id}`)
      }
    }

    // Step 2: Find orphaned files in upload directories
    const uploadDirs = [
      path.join(uploadsRoot, "imports"),
      path.join(uploadsRoot, "bank-statements"),
    ]

    for (const dir of uploadDirs) {
      try {
        // Check if directory exists
        await fs.access(dir)

        const files = await fs.readdir(dir)

        for (const file of files) {
          try {
            const filePath = path.join(dir, file)
            const stats = await fs.stat(filePath)

            // Skip directories
            if (!stats.isFile()) continue

            // Check if this file is referenced by any ImportJob
            const referencedJob = await db.importJob.findFirst({
              where: {
                storagePath: filePath,
              },
              select: { id: true },
            })

            if (!referencedJob) {
              // File is orphaned - move to trash
              const trashPath = path.join(trashDir, `${Date.now()}-${file}`)
              await fs.rename(filePath, trashPath)

              bankingLogger.info(
                { originalPath: filePath, trashPath },
                "Moved orphaned file to trash"
              )
              results.orphanedFilesMoved++
            }
          } catch (error) {
            bankingLogger.error({ error, file, dir }, "Failed to process file during orphan check")
            results.errors.push(`Failed to process ${file}`)
          }
        }
      } catch (error) {
        // Directory might not exist yet, skip it
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          bankingLogger.warn({ error, dir }, "Failed to scan directory for orphaned files")
        }
      }
    }

    // Step 3: Permanently delete files in trash older than 30 days
    try {
      const trashFiles = await fs.readdir(trashDir)

      for (const file of trashFiles) {
        try {
          const filePath = path.join(trashDir, file)
          const stats = await fs.stat(filePath)

          if (!stats.isFile()) continue

          // Check file age
          const fileAge = Date.now() - stats.mtimeMs
          const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000

          if (fileAge > thirtyDaysMs) {
            await fs.unlink(filePath)
            bankingLogger.info(
              { path: filePath, ageInDays: Math.floor(fileAge / (24 * 60 * 60 * 1000)) },
              "Permanently deleted file from trash"
            )
            results.trashPurged++
          }
        } catch (error) {
          bankingLogger.error({ error, file }, "Failed to purge file from trash")
          results.errors.push(`Failed to purge ${file}`)
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        bankingLogger.warn({ error }, "Failed to read trash directory")
      }
    }

    bankingLogger.info(results, "Upload cleanup job completed")

    return NextResponse.json({
      success: true,
      ...results,
    })
  } catch (error) {
    bankingLogger.error({ error }, "Upload cleanup job failed")
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    return NextResponse.json(
      {
        error: "Cleanup failed",
        details: error instanceof Error ? error.message : String(error),
        partialResults: results,
      },
      { status: 500 }
    )
  }
}
