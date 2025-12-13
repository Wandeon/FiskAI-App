// src/app/api/exports/company/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils";
import { exportCompanyData, validateBackupData } from "@/lib/backup/export";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const company = await getCurrentCompany(user.id!);
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    logger.info({
      userId: user.id,
      companyId: company.id,
      operation: "company_export_request"
    }, "Company data export requested");

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const includeSensitive = searchParams.get("includeSensitive") === "true";
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // Determine date range if provided
    let dateRange = undefined;
    if (dateFrom && dateTo) {
      dateRange = {
        from: new Date(dateFrom),
        to: new Date(dateTo),
      };
      
      // Validate date range
      if (isNaN(dateRange.from.getTime()) || isNaN(dateRange.to.getTime())) {
        return NextResponse.json(
          { error: "Invalid date format. Use ISO format (YYYY-MM-DD)" },
          { status: 400 }
        );
      }
    }

    // Export the company data
    const exportData = await exportCompanyData({
      userId: user.id!,
      companyId: company.id,
      includeSensitive,
      dateRange,
    });

    // Validate the exported data
    const validation = validateBackupData(exportData);
    if (!validation.valid) {
      logger.error({
        userId: user.id,
        companyId: company.id,
        validationErrors: validation.errors
      }, "Exported data validation failed");
      
      return NextResponse.json(
        { error: "Export validation failed", details: validation.errors },
        { status: 500 }
      );
    }

    // Create a filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `fiskai-backup-${company.name.replace(/\s+/g, '_')}-${timestamp}.json`;

    // Return the data as JSON with appropriate headers
    const response = new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Export-Type": "company-data",
        "X-Company-Id": company.id,
        "X-Export-Timestamp": exportData.createdAt.toISOString(),
      },
    });

    logger.info({
      userId: user.id,
      companyId: company.id,
      filename,
      operation: "company_export_success"
    }, "Company data export completed successfully");

    return response;
  } catch (error) {
    logger.error({ error }, "Company export failed");

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Export failed", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Export failed due to unknown error" },
      { status: 500 }
    );
  }
}