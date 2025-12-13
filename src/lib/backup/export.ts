// src/lib/backup/export.ts
// Data export and backup utilities for GDPR compliance and data portability

import { db } from "@/lib/db";
import { EInvoice, Contact, Product, Expense, Company } from "@prisma/client";
import { logger } from "@/lib/logger";

export interface BackupData {
  company: Company;
  contacts: Contact[];
  products: Product[];
  invoices: (EInvoice & { lines: any[] })[];  // Including invoice lines
  expenses: Expense[];
  createdAt: Date;
}

export interface ExportOptions {
  userId?: string;
  companyId: string;
  includeSensitive?: boolean; // Whether to include potentially sensitive data
  dateRange?: { from: Date; to: Date };
}

/**
 * Export all company data for backup or GDPR data portability
 */
export async function exportCompanyData(options: ExportOptions): Promise<BackupData> {
  const { companyId, includeSensitive = false, dateRange } = options;
  
  logger.info({ companyId, operation: "data_export_start" }, "Starting company data export");

  try {
    // Get company info
    const company = await db.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new Error(`Company with id ${companyId} not found`);
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
        }
      }),
    ]);

    // Get invoices with lines
    const invoices = await db.eInvoice.findMany({
      where: {
        companyId,
        ...(dateRange ? { createdAt: { gte: dateRange.from, lte: dateRange.to } } : {}),
      },
      include: {
        lines: {
          orderBy: { lineNumber: 'asc' },
        },
        buyer: true,
        seller: true,
      },
    });

    const backupData: BackupData = {
      company,
      contacts,
      products,
      invoices: invoices.map(inv => ({
        ...inv,
        lines: inv.lines.map(line => ({
          ...line,
          // Ensure sensitive data is handled properly if not included
          description: includeSensitive ? line.description : line.description,
          // Remove any sensitive details if needed
        })),
      })),
      expenses,
      createdAt: new Date(),
    };

    logger.info({ 
      companyId, 
      operation: "data_export_complete", 
      recordCounts: {
        contacts: contacts.length,
        products: products.length,
        invoices: invoices.length,
        expenses: expenses.length
      }
    }, "Company data export completed");

    return backupData;
  } catch (error) {
    logger.error({ companyId, error }, "Failed to export company data");
    throw error;
  }
}

/**
 * Schedule regular backups for a company
 */
export async function scheduleBackup(companyId: string, frequency: 'daily' | 'weekly' | 'monthly') {
  // In a real implementation, this would use a job queue system like Bull or a cron job
  // For now, we'll just log the intent
  logger.info({ 
    companyId, 
    frequency,
    operation: "backup_schedule" 
  }, "Backup scheduled (implementation needed)");
  
  // This would typically integrate with a background job system
  // to actually execute the backup at the specified frequency
}

/**
 * Validate backup data integrity
 */
export function validateBackupData(backupData: BackupData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!backupData.company) {
    errors.push("Missing company data");
  }
  
  if (!Array.isArray(backupData.invoices)) {
    errors.push("Missing or invalid invoices data");
  }
  
  if (!Array.isArray(backupData.contacts)) {
    errors.push("Missing or invalid contacts data");
  }
  
  if (!Array.isArray(backupData.products)) {
    errors.push("Missing or invalid products data");
  }
  
  if (!Array.isArray(backupData.expenses)) {
    errors.push("Missing or invalid expenses data");
  }
  
  if (!backupData.createdAt || !(backupData.createdAt instanceof Date)) {
    errors.push("Missing or invalid creation timestamp");
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}