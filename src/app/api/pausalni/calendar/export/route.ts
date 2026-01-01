import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { drizzleDb } from "@/lib/db/drizzle"
import { paymentObligation } from "@/lib/db/schema/pausalni"
import { eq, and, gte, lte } from "drizzle-orm"
import { generateObligationsICS, generateICSFilename } from "@/lib/pausalni/calendar/ics-generator"
import { withApiLogging } from "@/lib/api-logging"
import { setTenantContext } from "@/lib/prisma-extensions"
import { parseQuery, isValidationError, formatValidationError } from "@/lib/api/validation"
import { calendarExportQuerySchema } from "@/app/api/pausalni/_schemas"

export const GET = withApiLogging(async (request: NextRequest) => {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    setTenantContext({
      companyId: company.id,
      userId: user.id!,
    })

    // Parse and validate query params
    const { year } = parseQuery(request.nextUrl.searchParams, calendarExportQuerySchema)

    // Fetch all obligations for the year
    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year, 11, 31)

    const obligations = await drizzleDb
      .select()
      .from(paymentObligation)
      .where(
        and(
          eq(paymentObligation.companyId, company.id),
          gte(paymentObligation.dueDate, startDate.toISOString().split("T")[0]),
          lte(paymentObligation.dueDate, endDate.toISOString().split("T")[0])
        )
      )

    if (obligations.length === 0) {
      return NextResponse.json(
        { error: "No obligations found for the specified year" },
        { status: 404 }
      )
    }

    // Convert obligations to the format expected by the ICS generator
    const obligationsForICS = obligations.map((ob) => ({
      id: ob.id,
      obligationType: ob.obligationType,
      periodMonth: ob.periodMonth,
      periodYear: ob.periodYear,
      amount: ob.amount,
      dueDate: ob.dueDate,
      status: ob.status,
    }))

    // Generate ICS file
    const result = generateObligationsICS({
      obligations: obligationsForICS,
      companyName: company.name,
    })

    if (!result.success || !result.icsContent) {
      console.error("Failed to generate ICS:", result.error)
      return NextResponse.json(
        { error: result.error || "Failed to generate calendar" },
        { status: 500 }
      )
    }

    // Generate filename
    const filename = generateICSFilename(year, company.name)

    // Return ICS file with proper headers
    return new NextResponse(result.icsContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache",
      },
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Error generating calendar export:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})
