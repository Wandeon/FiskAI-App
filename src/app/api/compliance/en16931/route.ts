// src/app/api/compliance/en16931/route.ts
// API endpoint for EN 16931 compliance validation

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth, requireCompany } from "@/lib/auth-utils";
import { validateEN16931Compliance, validateCroatianCompliance, getComplianceSummary } from "@/lib/compliance/en16931-validator";
import { logger } from "@/lib/logger";

const complianceCheckSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const company = await requireCompany(user.id!);

    const body = await request.json();
    const parsed = complianceCheckSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { invoiceId } = parsed.data;

    // Fetch the invoice with all related data
    const invoice = await db.eInvoice.findFirst({
      where: {
        id: invoiceId,
        companyId: company.id,
      },
      include: {
        lines: { orderBy: { lineNumber: 'asc' } },
        buyer: true,
        seller: true,
      }
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Perform compliance checks
    const complianceSummary = getComplianceSummary(invoice);

    logger.info({
      userId: user.id,
      companyId: company.id,
      invoiceId,
      en16931Compliant: complianceSummary.en16931Compliant,
      croatianCompliant: complianceSummary.croatianCompliant,
      criticalErrorCount: complianceSummary.criticalErrors.length,
      operation: "compliance_check"
    }, `Compliance check completed for invoice ${invoice.invoiceNumber}`);

    return NextResponse.json({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      compliant: {
        en16931: complianceSummary.en16931Compliant,
        croatian: complianceSummary.croatianCompliant,
      },
      summary: complianceSummary,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error({ error }, "Failed to perform compliance check");

    return NextResponse.json(
      { error: "Failed to perform compliance check" },
      { status: 500 }
    );
  }
}

// GET endpoint to check compliance for multiple invoices
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const company = await requireCompany(user.id!);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // Only check invoices with specific status
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Fetch invoices to check
    const whereClause: any = {
      companyId: company.id,
    };

    if (status) {
      whereClause.status = status;
    }

    const invoices = await db.eInvoice.findMany({
      where: whereClause,
      include: {
        lines: { orderBy: { lineNumber: 'asc' } },
        buyer: true,
      },
      take: Math.min(limit, 1000), // Cap at 1000 to prevent excessive load
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });

    const results = invoices.map(invoice => {
      const summary = getComplianceSummary(invoice);
      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate,
        status: invoice.status,
        compliant: {
          en16931: summary.en16931Compliant,
          croatian: summary.croatianCompliant,
        },
        errorCount: summary.errors.length,
        criticalErrorCount: summary.criticalErrors.length,
      };
    });

    // Calculate overall compliance statistics
    const totalInvoices = results.length;
    const en16931Compliant = results.filter(r => r.compliant.en16931).length;
    const croatianCompliant = results.filter(r => r.compliant.croatian).length;

    logger.info({
      userId: user.id,
      companyId: company.id,
      totalChecked: totalInvoices,
      en16931Compliant,
      croatianCompliant,
      operation: "bulk_compliance_check"
    }, `Bulk compliance check completed for ${totalInvoices} invoices`);

    return NextResponse.json({
      results,
      statistics: {
        totalInvoices,
        en16931Compliant,
        croatianCompliant,
        en16931ComplianceRate: totalInvoices > 0 ? (en16931Compliant / totalInvoices) * 100 : 0,
        croatianComplianceRate: totalInvoices > 0 ? (croatianCompliant / totalInvoices) * 100 : 0,
      },
      pagination: {
        limit: Math.min(limit, 1000),
        offset,
        hasMore: invoices.length === Math.min(limit, 1000),
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logger.error({ error }, "Failed to perform bulk compliance check");

    return NextResponse.json(
      { error: "Failed to perform bulk compliance check" },
      { status: 500 }
    );
  }
}