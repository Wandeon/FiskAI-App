// src/lib/archive/archive-manager.ts
// Archive management for long-term storage and compliance

import { db } from "@/lib/db"
import { EInvoice, Company } from "@prisma/client"
import { logger } from "@/lib/logger"

export interface ArchiveOptions {
  retentionPeriodYears?: number // Default: 11 years for Croatian compliance
  retentionStartFrom?: Date // When retention period starts (e.g., invoice issue date, fiscalization date)
  immutable?: boolean // Whether archived data should be immutable
  exportFormat?: "json" | "xml" | "pdf" // Format for export
}

export interface ArchiveResult {
  success: boolean
  archiveId?: string
  archivedCount: number
  errors?: string[]
  message: string
}

/**
 * Archive invoices that meet retention criteria
 */
export async function archiveInvoices(
  companyId: string,
  options: ArchiveOptions = {}
): Promise<ArchiveResult> {
  try {
    const {
      retentionPeriodYears = 11, // Croatian requirement: 11 years
      retentionStartFrom = new Date(), // Could be issue date, fiscalization date, etc.
      immutable = true,
      exportFormat = "json",
    } = options

    // Calculate the cutoff date (anything before this date should be archived)
    const cutoffDate = new Date()
    cutoffDate.setFullYear(cutoffDate.getFullYear() - retentionPeriodYears)

    // Find invoices that are eligible for archiving
    // These are invoices that are older than the retention period
    const invoicesToArchive = await db.eInvoice.findMany({
      where: {
        companyId,
        issueDate: { lte: cutoffDate },
        status: { in: ["FISCALIZED", "SENT", "DELIVERED", "ACCEPTED", "ARCHIVED"] }, // Can archive these statuses
        archivedAt: null, // Not already archived
      },
      include: {
        lines: { orderBy: { lineNumber: "asc" } },
        buyer: true,
        seller: true,
      },
    })

    if (invoicesToArchive.length === 0) {
      logger.info({
        companyId,
        operation: "archive_check",
        message: "No invoices eligible for archiving",
      })

      return {
        success: true,
        archivedCount: 0,
        message: "No invoices eligible for archiving",
      }
    }

    // In a real implementation, we would export to a secure long-term storage
    // For now, we'll just mark them as archived in the database
    const archiveIds: string[] = []
    const errors: string[] = []

    for (const invoice of invoicesToArchive) {
      try {
        // Create an archive reference
        const archiveRef = `ARCHIVE-${invoice.id}-${Date.now()}`

        // Update invoice to mark as archived
        await db.eInvoice.update({
          where: { id: invoice.id },
          data: {
            archivedAt: new Date(),
            archiveRef,
            status: "ARCHIVED",
          },
        })

        archiveIds.push(archiveRef)

        // Log the archiving event
        logger.info(
          {
            companyId,
            invoiceId: invoice.id,
            archiveRef,
            operation: "invoice_archived",
            immutable,
          },
          "Invoice archived successfully"
        )
      } catch (error) {
        errors.push(
          `Failed to archive invoice ${invoice.id}: ${error instanceof Error ? error.message : "Unknown error"}`
        )
        logger.error(
          {
            companyId,
            invoiceId: invoice.id,
            error,
          },
          "Failed to archive invoice"
        )
      }
    }

    logger.info(
      {
        companyId,
        archivedCount: archiveIds.length,
        errorsCount: errors.length,
        operation: "batch_archive_completed",
      },
      `Batch archive completed for ${archiveIds.length} invoices`
    )

    return {
      success: true,
      archivedCount: archiveIds.length,
      archiveId: archiveIds[0], // Return first archive ID as example
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully archived ${archiveIds.length} invoices${errors.length > 0 ? ` with ${errors.length} errors` : ""}`,
    }
  } catch (error) {
    logger.error({ error, companyId }, "Failed to archive invoices")

    return {
      success: false,
      archivedCount: 0,
      errors: [error instanceof Error ? error.message : "Unknown error"],
      message: "Failed to archive invoices",
    }
  }
}

/**
 * Check which invoices are eligible for archiving
 */
export async function checkArchiveEligibility(
  companyId: string,
  retentionPeriodYears: number = 11
): Promise<{
  count: number
  oldestDate?: Date
  oldestInvoiceId?: string
  invoices: Array<{
    id: string
    invoiceNumber: string
    issueDate: Date
    fiscalizedAt?: Date | null
    daysOld: number
    status: string
  }>
}> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setFullYear(cutoffDate.getFullYear() - retentionPeriodYears)

    const invoices = await db.eInvoice.findMany({
      where: {
        companyId,
        issueDate: { lte: cutoffDate },
        status: { in: ["FISCALIZED", "SENT", "DELIVERED", "ACCEPTED"] }, // Can archive these statuses
        archivedAt: null, // Not already archived
      },
      select: {
        id: true,
        invoiceNumber: true,
        issueDate: true,
        fiscalizedAt: true,
        status: true,
      },
      orderBy: { issueDate: "asc" },
      take: 100, // Limit to prevent huge result sets
    })

    const now = new Date()
    const resultInvoices = invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      fiscalizedAt: invoice.fiscalizedAt,
      status: invoice.status,
      daysOld: Math.floor((now.getTime() - invoice.issueDate.getTime()) / (1000 * 60 * 60 * 24)),
    }))

    const result = {
      count: resultInvoices.length,
      oldestDate: resultInvoices.length > 0 ? resultInvoices[0].issueDate : undefined,
      oldestInvoiceId: resultInvoices.length > 0 ? resultInvoices[0].id : undefined,
      invoices: resultInvoices,
    }

    logger.info(
      {
        companyId,
        eligibleCount: result.count,
        operation: "archive_eligibility_check",
      },
      "Archive eligibility check completed"
    )

    return result
  } catch (error) {
    logger.error({ error, companyId }, "Failed to check archive eligibility")
    throw error
  }
}

/**
 * Export archived data for regulatory compliance
 */
interface JsonExportData {
  companyId: string
  exportDate: string
  count: number
  period: { startDate: string; endDate: string }
  invoices: unknown[]
}

interface CsvExportRow {
  invoiceNumber: string
  issueDate: string
  fiscalizedAt: string
  status: string
  netAmount: string
  vatAmount: string
  totalAmount: string
  buyerName: string
  buyerOib: string
  archivedAt: string
}

type ArchiveExportData = JsonExportData | CsvExportRow[] | unknown[]

export async function exportArchiveData(
  companyId: string,
  startDate: Date,
  endDate: Date,
  format: "json" | "xml" | "csv" = "json"
): Promise<{
  success: boolean
  data: ArchiveExportData | null
  filename: string
  count: number
  message: string
}> {
  try {
    const archivedInvoices = await db.eInvoice.findMany({
      where: {
        companyId,
        archivedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        lines: { orderBy: { lineNumber: "asc" } },
        buyer: true,
        seller: true,
      },
      orderBy: { archivedAt: "desc" },
    })

    let exportedData: ArchiveExportData
    let filename: string

    switch (format) {
      case "json":
        exportedData = {
          companyId,
          exportDate: new Date().toISOString(),
          count: archivedInvoices.length,
          period: { startDate: startDate.toISOString(), endDate: endDate.toISOString() },
          invoices: archivedInvoices.map((inv) => ({
            ...inv,
            issueDate: inv.issueDate.toISOString(),
            fiscalizedAt: inv.fiscalizedAt?.toISOString() || null,
            createdAt: inv.createdAt.toISOString(),
            updatedAt: inv.updatedAt.toISOString(),
            archivedAt: inv.archivedAt?.toISOString() || null,
            // EInvoiceLine may have optional date fields
            lines: inv.lines.map((line) => {
              const lineWithDates = line as typeof line & { createdAt?: Date; updatedAt?: Date }
              return {
                ...line,
                createdAt: lineWithDates.createdAt?.toISOString?.() ?? undefined,
                updatedAt: lineWithDates.updatedAt?.toISOString?.() ?? undefined,
              }
            }),
          })),
        }
        filename = `fiskai-archive-export-${companyId}-${startDate.toISOString().split("T")[0]}-to-${endDate.toISOString().split("T")[0]}.json`
        break

      case "csv":
        // For CSV, we'll create a simplified version
        exportedData = archivedInvoices.map((inv) => ({
          invoiceNumber: inv.invoiceNumber,
          issueDate: inv.issueDate.toISOString(),
          fiscalizedAt: inv.fiscalizedAt?.toISOString() || "",
          status: inv.status,
          netAmount: inv.netAmount.toString(),
          vatAmount: inv.vatAmount.toString(),
          totalAmount: inv.totalAmount.toString(),
          buyerName: inv.buyer?.name || "",
          buyerOib: inv.buyer?.oib || "",
          archivedAt: inv.archivedAt?.toISOString() || "",
        }))
        filename = `fiskai-archive-export-${companyId}-${startDate.toISOString().split("T")[0]}-to-${endDate.toISOString().split("T")[0]}.csv`
        break

      default:
        // XML would be more complex to implement here
        exportedData = archivedInvoices
        filename = `fiskai-archive-export-${companyId}-${startDate.toISOString().split("T")[0]}-to-${endDate.toISOString().split("T")[0]}.json`
    }

    logger.info(
      {
        companyId,
        startDate,
        endDate,
        format,
        count: archivedInvoices.length,
        operation: "archive_export_completed",
      },
      "Archive export completed"
    )

    return {
      success: true,
      data: exportedData,
      filename,
      count: archivedInvoices.length,
      message: `Exported ${archivedInvoices.length} archived invoices`,
    }
  } catch (error) {
    logger.error({ error, companyId, startDate, endDate }, "Failed to export archive data")

    return {
      success: false,
      data: null,
      filename: "",
      count: 0,
      message: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Schedule automatic archiving for a company
 * (This would integrate with a job scheduler in production)
 */
export async function scheduleArchiveJob(
  companyId: string,
  schedule: "daily" | "weekly" | "monthly",
  retentionPeriodYears: number = 11
) {
  logger.info(
    {
      companyId,
      schedule,
      retentionPeriodYears,
      operation: "archive_job_scheduled",
    },
    "Archive job scheduled (implementation needed)"
  )

  // In a real implementation, this would schedule a recurring job
  // using a job queue system like Bull, Queue, or cron

  return {
    success: true,
    schedule,
    message: `Archive job scheduled for ${schedule} execution`,
  }
}
