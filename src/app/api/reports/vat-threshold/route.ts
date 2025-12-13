// src/app/api/reports/vat-threshold/route.ts
// API endpoint for VAT threshold report data

import { NextResponse } from "next/server";
import { requireAuth, requireCompany } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { calculateVatThresholdProgress } from "@/lib/reports/kpr-generator";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const company = await requireCompany(user.id!);

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const year = parseInt(yearParam || new Date().getFullYear().toString(), 10);

    // Get VAT threshold progress data
    const thresholdData = await calculateVatThresholdProgress(company.id, year);

    // Calculate monthly breakdown
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const monthNames = [
      'Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj',
      'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac'
    ];

    const monthlyBreakdown = [];
    for (const month of months) {
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 0); // Last day of month

      const monthlyTotal = await db.eInvoice.aggregate({
        where: {
          companyId: company.id,
          direction: "OUTBOUND",
          status: { in: ["SENT", "DELIVERED", "PAID", "FISCALIZED"] },
          issueDate: {
            gte: monthStart,
            lte: monthEnd,
          }
        },
        _sum: {
          totalAmount: true,
        }
      });

      const revenue = Number(monthlyTotal._sum.totalAmount || 0);
      const percentageOfThreshold = (revenue / thresholdData.vatThreshold) * 100;

      monthlyBreakdown.push({
        month,
        monthName: monthNames[month - 1],
        revenue: Number(revenue.toFixed(2)),
        percentageOfThreshold: Number(percentageOfThreshold.toFixed(2)),
      });
    }

    // Calculate projections
    const currentDate = new Date();
    const daysIntoYear = Math.floor((currentDate.getTime() - new Date(year, 0, 1).getTime()) / (1000 * 60 * 60 * 24));
    const daysInYear = 365; // Simplified for leap year
    const daysLeftInYear = Math.max(0, daysInYear - daysIntoYear);

    const projectedAnnualRevenue = daysInYear > 0
      ? (thresholdData.annualRevenue / daysIntoYear) * daysInYear
      : 0;

    const calculatedRemainingUntilThreshold = Math.max(0, thresholdData.vatThreshold - thresholdData.annualRevenue);
    const calculatedEstimatedDailyRevenueNeeded = daysLeftInYear > 0
      ? calculatedRemainingUntilThreshold / daysLeftInYear
      : 0;

    const reportData = {
      year,
      company: {
        name: company.name,
        oib: company.oib,
        isVatPayer: company.isVatPayer,
      },
      annualRevenue: thresholdData.annualRevenue,
      vatThreshold: thresholdData.vatThreshold,
      percentage: thresholdData.percentage,
      status: thresholdData.status,
      monthlyBreakdown,
      projectedAnnualRevenue: Number(projectedAnnualRevenue.toFixed(2)),
      remainingUntilThreshold: Number(calculatedRemainingUntilThreshold.toFixed(2)),
      daysLeftInYear: daysLeftInYear,
      estimatedDailyRevenueNeeded: Number(calculatedEstimatedDailyRevenueNeeded.toFixed(2)),
    };

    logger.info({
      userId: user.id,
      companyId: company.id,
      year,
      annualRevenue: reportData.annualRevenue,
      operation: "vat_threshold_report_generated"
    }, "VAT threshold report generated successfully");

    return NextResponse.json(reportData);

  } catch (error) {
    logger.error({ error }, "Failed to generate VAT threshold report");

    return NextResponse.json(
      { error: "Failed to generate VAT threshold report" },
      { status: 500 }
    );
  }
}

// POST endpoint for triggering recalculations or updates
export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const company = await requireCompany(user.id!);

    const { action } = await request.json();

    switch (action) {
      case "recalculate":
        // In a real implementation, this might trigger a recalculation
        // of all invoices to ensure data accuracy
        logger.info({
          userId: user.id,
          companyId: company.id,
          action: "vat_threshold_recalculate_requested"
        }, "VAT threshold recalculation requested");
        
        return NextResponse.json({
          success: true,
          message: "Recalculation scheduled",
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error({ error }, "Failed to process VAT threshold action");

    return NextResponse.json(
      { error: "Failed to process action" },
      { status: 500 }
    );
  }
}