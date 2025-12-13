// src/lib/reports/kpr-generator.ts
// Croatian Book of Traffic (Knjiga Prometa) generator

import { db } from "@/lib/db";
import { EInvoice, EInvoiceLine, Company } from "@prisma/client";
import { logger } from "@/lib/logger";

export interface KPRRecord {
  id: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate?: Date;
  buyerName: string;
  buyerOib?: string;
  netAmount: number;
  vat25Percent: number;
  vat13Percent: number;
  vat5Percent: number;
  vat0Percent: number;
  totalAmount: number;
  paymentMethod?: string; // G: Cash, K: Card, T: Transfer, O: Other
  currency: string;
  fiscalizedAt?: Date;
  jir?: string; // Jedinstveni Identifikator Računa
}

export interface KPRReport {
  period: {
    from: Date;
    to: Date;
  };
  company: {
    name: string;
    oib: string;
    address?: string;
  };
  records: KPRRecord[];
  totals: {
    totalNet: number;
    totalVat25: number;
    totalVat13: number;
    totalVat5: number;
    totalVat0: number;
    totalAmount: number;
  };
}

/**
 * Generate KPR (Knjiga Prometa) report for Croatian tax compliance
 */
export async function generateKPRReport(
  companyId: string,
  fromDate: Date,
  toDate: Date
): Promise<KPRReport> {
  try {
    // Get company information
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        name: true,
        oib: true,
        address: true,
      }
    });

    if (!company) {
      throw new Error(`Company with ID ${companyId} not found`);
    }

    // Get invoices for the period that are fiscalized (delivered or paid)
    const invoices = await db.eInvoice.findMany({
      where: {
        companyId,
        issueDate: {
          gte: fromDate,
          lte: toDate,
        },
        status: { in: ["SENT", "DELIVERED", "PAID", "FISCALIZED"] }, // Only fiscalized invoices
        direction: "OUTBOUND", // Only issued invoices count toward KPR
      },
      include: {
        lines: {
          orderBy: { lineNumber: 'asc' },
        },
        buyer: true,
      },
      orderBy: { issueDate: 'asc' },
    });

    // Calculate KPR records from invoices
    const records: KPRRecord[] = [];
    let totalNet = 0;
    let totalVat25 = 0;
    let totalVat13 = 0;
    let totalVat5 = 0;
    let totalVat0 = 0;
    let totalAmount = 0;

    for (const invoice of invoices) {
      // Calculate VAT totals by rate for this invoice
      const vatByRate = invoice.lines.reduce((acc, line) => {
        const rate = Number(line.vatRate);
        if (rate === 25) {
          acc.vat25 += Number(line.vatAmount);
          acc.net += Number(line.netAmount);
        } else if (rate === 13) {
          acc.vat13 += Number(line.vatAmount);
          acc.net += Number(line.netAmount);
        } else if (rate === 5) {
          acc.vat5 += Number(line.vatAmount);
          acc.net += Number(line.netAmount);
        } else if (rate === 0) {
          acc.vat0 += Number(line.vatAmount);
          acc.net += Number(line.netAmount);
        } else {
          acc.net += Number(line.netAmount);
        }
        return acc;
      }, { vat25: 0, vat13: 0, vat5: 0, vat0: 0, net: 0 });

      const record: KPRRecord = {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber || `[TEMP-${invoice.id.substring(0, 8)}]`,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate || undefined,
        buyerName: invoice.buyer?.name || "Nepoznat kupac",
        buyerOib: invoice.buyer?.oib,
        netAmount: Number(vatByRate.net),
        vat25Percent: Number(vatByRate.vat25),
        vat13Percent: Number(vatByRate.vat13),
        vat5Percent: Number(vatByRate.vat5),
        vat0Percent: Number(vatByRate.vat0),
        totalAmount: Number(invoice.totalAmount),
        paymentMethod: invoice.paymentMethod || 'O', // Other as default
        currency: invoice.currency,
        fiscalizedAt: invoice.fiscalizedAt || undefined,
        jir: invoice.jir || undefined,
      };

      records.push(record);

      // Add to totals
      totalNet += Number(vatByRate.net);
      totalVat25 += Number(vatByRate.vat25);
      totalVat13 += Number(vatByRate.vat13);
      totalVat5 += Number(vatByRate.vat5);
      totalVat0 += Number(vatByRate.vat0);
      totalAmount += Number(invoice.totalAmount);
    }

    const kprReport: KPRReport = {
      period: {
        from: fromDate,
        to: toDate,
      },
      company: {
        name: company.name,
        oib: company.oib,
        address: company.address,
      },
      records,
      totals: {
        totalNet: Number(totalNet.toFixed(2)),
        totalVat25: Number(totalVat25.toFixed(2)),
        totalVat13: Number(totalVat13.toFixed(2)),
        totalVat5: Number(totalVat5.toFixed(2)),
        totalVat0: Number(totalVat0.toFixed(2)),
        totalAmount: Number(totalAmount.toFixed(2)),
      },
    };

    logger.info({
      companyId,
      period: { from: fromDate, to: toDate },
      recordCount: records.length,
      operation: "kpr_report_generated"
    }, "KPR report generated successfully");

    return kprReport;
  } catch (error) {
    logger.error({ 
      error, 
      companyId, 
      fromDate, 
      toDate 
    }, "Failed to generate KPR report");
    
    throw error;
  }
}

/**
 * Generate monthly KPR summary for an entire year
 */
export async function generateMonthlyKPRSummary(
  companyId: string,
  year: number
): Promise<Array<{
  month: number; // 1-12
  monthName: string;
  records: KPRRecord[];
  totals: {
    totalNet: number;
    totalVat25: number;
    totalVat13: number;
    totalVat5: number;
    totalVat0: number;
    totalAmount: number;
  };
}>> {
  try {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const monthNames = [
      'Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj',
      'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac'
    ];
    
    const monthlyReports = [];

    for (const month of months) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0); // Last day of month
      
      const report = await generateKPRReport(companyId, startDate, endDate);
      
      monthlyReports.push({
        month,
        monthName: monthNames[month - 1],
        records: report.records,
        totals: report.totals,
      });
    }

    logger.info({
      companyId,
      year,
      operation: "monthly_kpr_summary_generated"
    }, "Monthly KPR summary generated successfully");

    return monthlyReports;
  } catch (error) {
    logger.error({ 
      error, 
      companyId, 
      year 
    }, "Failed to generate monthly KPR summary");
    
    throw error;
  }
}

/**
 * Calculate company's progress towards VAT threshold (40,000 EUR annually)
 */
export async function calculateVatThresholdProgress(
  companyId: string,
  year: number
): Promise<{
  annualRevenue: number;
  vatThreshold: number; // 40,000 EUR
  percentage: number;
  status: 'BELOW' | 'WARNING' | 'EXCEEDED'; // Over 36,000 is warning, over 40,000 is exceeded
}> {
  try {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    // Get all issued invoices for the year that are fiscalized
    const invoices = await db.eInvoice.findMany({
      where: {
        companyId,
        issueDate: {
          gte: startDate,
          lte: endDate,
        },
        status: { in: ["SENT", "DELIVERED", "PAID", "FISCALIZED"] }, // Only fiscalized invoices
        direction: "OUTBOUND", // Only issued invoices count toward threshold
      },
      select: {
        totalAmount: true,
        currency: true,
      },
    });

    // Calculate revenue - convert all to EUR for threshold calculation
    // In a real app, we'd need to convert based on exchange rates
    const annualRevenue = invoices.reduce((sum, invoice) => {
      const amount = Number(invoice.totalAmount);
      // For now, assume EUR unless otherwise noted
      return sum + amount;
    }, 0);

    const vatThreshold = 40000; // 40,000 EUR - Croatian VAT registration threshold
    const percentage = (annualRevenue / vatThreshold) * 100;
    let status: 'BELOW' | 'WARNING' | 'EXCEEDED' = 'BELOW';

    if (percentage >= 100) {
      status = 'EXCEEDED';
    } else if (percentage >= 90) { // Warning at 90% of limit
      status = 'WARNING';
    }

    logger.info({
      companyId,
      year,
      annualRevenue,
      percentage,
      status,
      operation: "vat_threshold_calculated"
    }, "VAT threshold calculation completed");

    return {
      annualRevenue,
      vatThreshold,
      percentage: Number(percentage.toFixed(2)),
      status,
    };
  } catch (error) {
    logger.error({ 
      error, 
      companyId, 
      year 
    }, "Failed to calculate VAT threshold progress");
    
    throw error;
  }
}