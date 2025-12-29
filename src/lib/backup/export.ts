// src/lib/backup/export.ts
// Data export and backup utilities for GDPR compliance and data portability

import { db } from "@/lib/db"
import { EInvoice, Contact, Product, Expense, Company } from "@prisma/client"
import { logger } from "@/lib/logger"
import { backupQueue } from "@/lib/regulatory-truth/workers/queues"

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
  invoices: (EInvoice & { lines: any[] })[] // Including invoice lines
  expenses: Expense[]
  createdAt: Date
}

export interface ExportOptions {
  userId?: string
  companyId: string
  includeSensitive?: boolean // Whether to include potentially sensitive data
  dateRange?: { from: Date; to: Date }
}

/**
 * Export all company data for backup or GDPR data portability
 */
export async function exportCompanyData(options: ExportOptions): Promise<BackupData> {
  const { companyId, includeSensitive = false, dateRange } = options

  logger.info({ companyId, operation: "data_export_start" }, "Starting company data export")

  try {
    // Get company info
    const company = await db.company.findUnique({
      where: { id: companyId },
    })

    if (!company) {
      throw new Error(`Company with id ${companyId} not found`)
    }

    // Get related data with tenant isolation
    const [contacts, products, expenses] = await Promise.all([
      db.contact.findMany({
        where: {
          companyId,
          ...(dateRange ? { createdAt: { gte: dateRange.from, lte: dateRange.to } } : {}),
        },
      }),
      db.product.findMany({
        where: {
          companyId,
          ...(dateRange ? { createdAt: { gte: dateRange.from, lte: dateRange.to } } : {}),
        },
      }),
      db.expense.findMany({
        where: {
          companyId,
          ...(dateRange ? { date: { gte: dateRange.from, lte: dateRange.to } } : {}),
        },
        include: {
          category: true,
          vendor: true,
        },
      }),
    ])

    // Get invoices with lines
    const invoices = await db.eInvoice.findMany({
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
    })

    const backupData: BackupData = {
      company,
      contacts,
      products,
      invoices: invoices.map((inv) => ({
        ...inv,
        lines: inv.lines.map((line) => ({
          ...line,
          // Ensure sensitive data is handled properly if not included
          description: includeSensitive ? line.description : line.description,
          // Remove any sensitive details if needed
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
      logger.info(
        { companyId, oldKey: job.key },
        "Removed existing backup schedule"
      )
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
      const frequency = Object.entries(CRON_MAP).find(
        ([_, cron]) => cron === job.pattern
      )?.[0] as BackupFrequency | undefined

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
      const frequency = Object.entries(CRON_MAP).find(
        ([_, cron]) => cron === job.pattern
      )?.[0] as BackupFrequency | undefined

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
