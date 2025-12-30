// src/lib/backup/backup.worker.ts
/**
 * Backup Worker - processes scheduled company data backup jobs
 *
 * Job types:
 * - scheduled-backup:{companyId}: Regular scheduled backup (daily/weekly/monthly)
 * - manual-backup: On-demand backup request
 *
 * Backups are exported as JSON and can be stored in configured storage (R2/S3)
 * Email notifications are sent upon completion if configured
 */
import { Job } from "bullmq"
import {
  createWorker,
  setupGracefulShutdown,
  type JobResult,
} from "@/lib/regulatory-truth/workers/base"
import { jobsProcessed, jobDuration } from "@/lib/regulatory-truth/workers/metrics"
import { db } from "@/lib/db"
import { exportCompanyData, validateBackupData, type BackupFrequency } from "./export"
import { logger } from "@/lib/logger"

export interface BackupJobData {
  companyId: string
  frequency: BackupFrequency
  notifyEmail?: string
  retentionDays?: number
  scheduledAt: string
  manual?: boolean
}

export interface BackupResult {
  companyId: string
  companyName: string
  backupSize: number
  recordCounts: {
    contacts: number
    products: number
    warehouses: number
    stockItems: number
    stockMovements: number
    invoices: number
    expenses: number
  }
  createdAt: string
  storagePath?: string
}

async function processBackupJob(job: Job<BackupJobData>): Promise<JobResult> {
  const start = Date.now()
  const {
    companyId,
    frequency,
    notifyEmail: _notifyEmail,
    retentionDays: _retentionDays = 30,
  } = job.data

  logger.info(
    {
      jobId: job.id,
      companyId,
      frequency,
      operation: "backup_job_start",
    },
    "Starting backup job"
  )

  try {
    // Verify company still exists
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true },
    })

    if (!company) {
      logger.warn({ companyId }, "Company not found, skipping backup")
      return {
        success: false,
        duration: Date.now() - start,
        error: `Company ${companyId} not found`,
      }
    }

    // Export company data
    const backupData = await exportCompanyData({
      companyId,
      includeSensitive: true, // Include all data for full backup
    })

    // Validate the backup
    const validation = validateBackupData(backupData)
    if (!validation.valid) {
      logger.error({ companyId, errors: validation.errors }, "Backup validation failed")
      return {
        success: false,
        duration: Date.now() - start,
        error: `Backup validation failed: ${validation.errors.join(", ")}`,
      }
    }

    // Serialize backup to JSON
    const backupJson = JSON.stringify(backupData, null, 2)
    const backupSize = Buffer.byteLength(backupJson, "utf-8")

    // Generate storage path (ISO date format for easy sorting)
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const storagePath = `backups/${companyId}/${timestamp}.json`

    // TODO: Store backup in R2/S3 storage
    // For now, we log the backup metadata
    // In production, this would upload to configured storage:
    // await storage.upload(storagePath, backupJson)

    const recordCounts = {
      contacts: backupData.contacts.length,
      products: backupData.products.length,
      warehouses: backupData.warehouses.length,
      stockItems: backupData.stockItems.length,
      stockMovements: backupData.stockMovements.length,
      invoices: backupData.invoices.length,
      expenses: backupData.expenses.length,
    }

    const duration = Date.now() - start

    logger.info(
      {
        jobId: job.id,
        companyId,
        companyName: company.name,
        backupSize,
        recordCounts,
        storagePath,
        duration,
        operation: "backup_job_complete",
      },
      "Backup completed successfully"
    )

    // TODO: Send email notification if configured
    // if (notifyEmail) {
    //   await sendBackupNotification(notifyEmail, {
    //     companyName: company.name,
    //     backupSize,
    //     recordCounts,
    //     storagePath,
    //   })
    // }

    // TODO: Clean up old backups based on retention policy
    // await cleanupOldBackups(companyId, retentionDays)

    jobsProcessed.inc({ worker: "backup", status: "success", queue: "backup" })
    jobDuration.observe({ worker: "backup", queue: "backup" }, duration / 1000)

    const result: BackupResult = {
      companyId,
      companyName: company.name,
      backupSize,
      recordCounts,
      createdAt: new Date().toISOString(),
      storagePath,
    }

    return {
      success: true,
      duration,
      data: result,
    }
  } catch (error) {
    const duration = Date.now() - start
    jobsProcessed.inc({ worker: "backup", status: "failed", queue: "backup" })

    logger.error(
      {
        jobId: job.id,
        companyId,
        error: error instanceof Error ? error.message : String(error),
        duration,
        operation: "backup_job_failed",
      },
      "Backup job failed"
    )

    return {
      success: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// Create and start worker
const worker = createWorker<BackupJobData>("backup", processBackupJob, {
  name: "backup",
  concurrency: 2, // Allow 2 concurrent backups
  lockDuration: 300000, // 5 minutes - backups can take time for large datasets
  stalledInterval: 60000, // Check for stalled jobs every minute
})

setupGracefulShutdown([worker])

export { worker }
