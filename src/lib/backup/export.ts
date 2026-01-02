// src/lib/backup/export.ts
// Data export and backup utilities for GDPR compliance and data portability

import { db } from "@/lib/db"
import {
  EInvoice,
  EInvoiceLine,
  Contact,
  Product,
  Expense,
  Company,
  Warehouse,
  StockItem,
  StockMovement,
} from "@prisma/client"
import { logger } from "@/lib/logger"
import { backupQueue } from "@/lib/regulatory-truth/workers/queues"
import { requirePermission } from "@/lib/rbac"
import { checkRateLimit } from "@/lib/security/rate-limit"

export type BackupFrequency = "daily" | "weekly" | "monthly"

export interface BackupScheduleOptions {
  companyId: string
  frequency: BackupFrequency
  notifyEmail?: string // Optional email to notify on backup completion
  retentionDays?: number // How long to keep backups (default: 30)
}

export interface ScheduledBackupResult {
  jobId: string
  companyId: string
  frequency: BackupFrequency
  nextRunAt: Date
  cronExpression: string
}

export interface BackupData {
  company: Company
  contacts: Contact[]
  products: Product[]
  warehouses: Warehouse[]
  stockItems: StockItem[]
  stockMovements: StockMovement[]
  invoices: (EInvoice & { lines: EInvoiceLine[] })[] // Including invoice lines
  expenses: Expense[]
  createdAt: Date
}

export interface ExportOptions {
  userId?: string
  companyId: string
  includeSensitive?: boolean // Whether to include potentially sensitive data
  dateRange?: { from: Date; to: Date }
}

// Maximum records per entity to prevent memory exhaustion
const MAX_RECORDS_PER_ENTITY = 10000

// Batch size for fetching records
const BATCH_SIZE = 1000

/**
 * Fetch records in batches to prevent memory issues
 */
async function fetchInBatches<T>(
  fetcher: (skip: number, take: number) => Promise<T[]>,
  maxRecords: number = MAX_RECORDS_PER_ENTITY
): Promise<T[]> {
  const results: T[] = []
  let skip = 0

  while (skip < maxRecords) {
    const batch = await fetcher(skip, BATCH_SIZE)
    if (batch.length === 0) break
    results.push(...batch)
    skip += batch.length
    if (batch.length < BATCH_SIZE) break
  }

  return results
}

/**
 * Export all company data for backup or GDPR data portability
 */
export async function exportCompanyData(options: ExportOptions): Promise<BackupData> {
  const { userId, companyId, includeSensitive = false, dateRange } = options

  // Permission check - only OWNER and ADMIN can export company data
  if (userId) {
    await requirePermission(userId, companyId, "company:export")
  }

  // Rate limiting - prevent abuse of expensive export operations
  const rateLimitKey = `export:${companyId}`
  const rateLimitResult = await checkRateLimit(rateLimitKey, "EXPORT")
  if (!rateLimitResult.allowed) {
    const resetTime = rateLimitResult.blockedUntil || rateLimitResult.resetAt
    throw new Error(
      `Export rate limit exceeded. Please try again after ${resetTime ? new Date(resetTime).toISOString() : "some time"}.`
    )
  }

  logger.info({ companyId, operation: "data_export_start" }, "Starting company data export")

  try {
    // Get company info
    const company = await db.company.findUnique({
      where: { id: companyId },
    })

    if (!company) {
      throw new Error(`Company with id ${companyId} not found`)
    }

    // Get related data with tenant isolation using batched fetching
    const [contacts, products, warehouses, stockItems, stockMovements, expenses] =
      await Promise.all([
        fetchInBatches((skip, take) =>
          db.contact.findMany({
            where: {
              companyId,
              ...(dateRange ? { createdAt: { gte: dateRange.from, lte: dateRange.to } } : {}),
            },
            skip,
            take,
            orderBy: { createdAt: "asc" },
          })
        ),
        fetchInBatches((skip, take) =>
          db.product.findMany({
            where: {
              companyId,
              ...(dateRange ? { createdAt: { gte: dateRange.from, lte: dateRange.to } } : {}),
            },
            skip,
            take,
            orderBy: { createdAt: "asc" },
          })
        ),
        fetchInBatches((skip, take) =>
          db.warehouse.findMany({
            where: {
              companyId,
              ...(dateRange ? { createdAt: { gte: dateRange.from, lte: dateRange.to } } : {}),
            },
            skip,
            take,
            orderBy: { createdAt: "asc" },
          })
        ),
        fetchInBatches((skip, take) =>
          db.stockItem.findMany({
            where: {
              companyId,
              ...(dateRange ? { createdAt: { gte: dateRange.from, lte: dateRange.to } } : {}),
            },
            skip,
            take,
            orderBy: { createdAt: "asc" },
          })
        ),
        fetchInBatches((skip, take) =>
          db.stockMovement.findMany({
            where: {
              companyId,
              ...(dateRange ? { movementDate: { gte: dateRange.from, lte: dateRange.to } } : {}),
            },
            skip,
            take,
            orderBy: { movementDate: "asc" },
          })
        ),
        fetchInBatches((skip, take) =>
          db.expense.findMany({
            where: {
              companyId,
              ...(dateRange ? { date: { gte: dateRange.from, lte: dateRange.to } } : {}),
            },
            include: {
              category: true,
              vendor: true,
            },
            skip,
            take,
            orderBy: { date: "asc" },
          })
        ),
      ])

    // Get invoices with lines using batched fetching
    const invoices = await fetchInBatches((skip, take) =>
      db.eInvoice.findMany({
        where: {
          companyId,
          ...(dateRange ? { createdAt: { gte: dateRange.from, lte: dateRange.to } } : {}),
        },
        include: {
          lines: {
            orderBy: { lineNumber: "asc" },
          },
          buyer: true,
          seller: true,
        },
        skip,
        take,
        orderBy: { createdAt: "asc" },
      })
    )

    const backupData: BackupData = {
      company,
      contacts,
      products,
      warehouses,
      stockItems,
      stockMovements,
      invoices: invoices.map((inv) => ({
        ...inv,
        lines: inv.lines.map((line) => ({
          ...line,
          // Redact sensitive data if not explicitly included
          description: includeSensitive ? line.description : "[REDACTED]",
        })),
      })),
      expenses,
      createdAt: new Date(),
    }

    logger.info(
      {
        companyId,
        operation: "data_export_complete",
        recordCounts: {
          contacts: contacts.length,
          products: products.length,
          warehouses: warehouses.length,
          stockItems: stockItems.length,
          stockMovements: stockMovements.length,
          invoices: invoices.length,
          expenses: expenses.length,
        },
      },
      "Company data export completed"
    )

    return backupData
  } catch (error) {
    logger.error({ companyId, error }, "Failed to export company data")
    throw error
  }
}

/**
 * Cron expression map for backup frequencies
 * All backups run at 2 AM to minimize impact on active users
 */
const CRON_MAP: Record<BackupFrequency, string> = {
  daily: "0 2 * * *", // 2 AM every day
  weekly: "0 2 * * 0", // 2 AM every Sunday
  monthly: "0 2 1 * *", // 2 AM first day of month
}

/**
 * Calculate next run time based on cron expression
 */
function getNextRunTime(frequency: BackupFrequency): Date {
  const now = new Date()
  const next = new Date(now)

  // Set to 2 AM
  next.setHours(2, 0, 0, 0)

  // If already past 2 AM today, move to next occurrence
  if (now.getHours() >= 2) {
    next.setDate(next.getDate() + 1)
  }

  switch (frequency) {
    case "daily":
      // Already set to next 2 AM
      break
    case "weekly":
      // Move to next Sunday
      const daysUntilSunday = (7 - next.getDay()) % 7
      if (daysUntilSunday === 0 && now.getHours() >= 2) {
        next.setDate(next.getDate() + 7)
      } else {
        next.setDate(next.getDate() + daysUntilSunday)
      }
      break
    case "monthly":
      // Move to first of next month if past 2 AM on 1st
      if (next.getDate() > 1 || (next.getDate() === 1 && now.getHours() >= 2)) {
        next.setMonth(next.getMonth() + 1, 1)
      } else {
        next.setDate(1)
      }
      break
  }

  return next
}

/**
 * Schedule regular backups for a company using BullMQ repeatable jobs
 */
export async function scheduleBackup(
  companyId: string,
  frequency: BackupFrequency,
  options?: Omit<BackupScheduleOptions, "companyId" | "frequency">
): Promise<ScheduledBackupResult> {
  const cronExpression = CRON_MAP[frequency]
  const notifyEmail = options?.notifyEmail
  const retentionDays = options?.retentionDays ?? 30

  // Verify company exists before scheduling
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  })

  if (!company) {
    throw new Error(`Company with id ${companyId} not found`)
  }

  // Remove any existing scheduled backup for this company to avoid duplicates
  const existingJobs = await backupQueue.getRepeatableJobs()
  for (const job of existingJobs) {
    if (job.name === `scheduled-backup:${companyId}`) {
      await backupQueue.removeRepeatableByKey(job.key)
      logger.info({ companyId, oldKey: job.key }, "Removed existing backup schedule")
    }
  }

  // Add repeatable job with cron schedule
  const job = await backupQueue.add(
    `scheduled-backup:${companyId}`,
    {
      companyId,
      frequency,
      notifyEmail,
      retentionDays,
      scheduledAt: new Date().toISOString(),
    },
    {
      repeat: {
        pattern: cronExpression,
        tz: "Europe/Zagreb", // Croatian timezone for consistent scheduling
      },
      jobId: `backup:${companyId}:${frequency}`,
    }
  )

  const nextRunAt = getNextRunTime(frequency)

  logger.info(
    {
      companyId,
      companyName: company.name,
      frequency,
      cronExpression,
      jobId: job.id,
      nextRunAt: nextRunAt.toISOString(),
      operation: "backup_scheduled",
    },
    "Backup schedule created"
  )

  return {
    jobId: job.id ?? `backup:${companyId}:${frequency}`,
    companyId,
    frequency,
    nextRunAt,
    cronExpression,
  }
}

/**
 * Cancel scheduled backup for a company
 */
export async function cancelScheduledBackup(companyId: string): Promise<boolean> {
  const jobs = await backupQueue.getRepeatableJobs()
  let cancelled = false

  for (const job of jobs) {
    if (job.name === `scheduled-backup:${companyId}`) {
      await backupQueue.removeRepeatableByKey(job.key)
      cancelled = true
      logger.info(
        { companyId, key: job.key, operation: "backup_cancelled" },
        "Backup schedule cancelled"
      )
    }
  }

  return cancelled
}

/**
 * Get current backup schedule for a company
 */
export async function getBackupSchedule(
  companyId: string
): Promise<{ frequency: BackupFrequency; cronExpression: string; nextRunAt: Date } | null> {
  const jobs = await backupQueue.getRepeatableJobs()

  for (const job of jobs) {
    if (job.name === `scheduled-backup:${companyId}`) {
      // Extract frequency from job pattern
      const frequency = Object.entries(CRON_MAP).find(([_, cron]) => cron === job.pattern)?.[0] as
        | BackupFrequency
        | undefined

      if (frequency) {
        return {
          frequency,
          cronExpression: job.pattern ?? CRON_MAP[frequency],
          nextRunAt: job.next ? new Date(job.next) : getNextRunTime(frequency),
        }
      }
    }
  }

  return null
}

/**
 * List all active backup schedules
 */
export async function listAllBackupSchedules(): Promise<
  Array<{ companyId: string; frequency: BackupFrequency; nextRunAt: Date }>
> {
  const jobs = await backupQueue.getRepeatableJobs()
  const schedules: Array<{ companyId: string; frequency: BackupFrequency; nextRunAt: Date }> = []

  for (const job of jobs) {
    if (job.name?.startsWith("scheduled-backup:")) {
      const companyId = job.name.replace("scheduled-backup:", "")
      const frequency = Object.entries(CRON_MAP).find(([_, cron]) => cron === job.pattern)?.[0] as
        | BackupFrequency
        | undefined

      if (frequency) {
        schedules.push({
          companyId,
          frequency,
          nextRunAt: job.next ? new Date(job.next) : getNextRunTime(frequency),
        })
      }
    }
  }

  return schedules
}

/**
 * Validate backup data integrity
 */
export function validateBackupData(backupData: BackupData): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!backupData.company) {
    errors.push("Missing company data")
  }

  if (!Array.isArray(backupData.invoices)) {
    errors.push("Missing or invalid invoices data")
  }

  if (!Array.isArray(backupData.contacts)) {
    errors.push("Missing or invalid contacts data")
  }

  if (!Array.isArray(backupData.products)) {
    errors.push("Missing or invalid products data")
  }

  if (!Array.isArray(backupData.warehouses)) {
    errors.push("Missing or invalid warehouses data")
  }

  if (!Array.isArray(backupData.stockItems)) {
    errors.push("Missing or invalid stock items data")
  }

  if (!Array.isArray(backupData.stockMovements)) {
    errors.push("Missing or invalid stock movements data")
  }

  if (!Array.isArray(backupData.expenses)) {
    errors.push("Missing or invalid expenses data")
  }

  if (!backupData.createdAt || !(backupData.createdAt instanceof Date)) {
    errors.push("Missing or invalid creation timestamp")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
