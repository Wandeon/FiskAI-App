import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { drizzleDb } from "@/lib/db/drizzle"
import { paymentObligation, OBLIGATION_STATUS } from "@/lib/db/schema/pausalni"
import { eq, and } from "drizzle-orm"
import { withApiLogging } from "@/lib/api-logging"
import { setTenantContext } from "@/lib/prisma-extensions"
import {
  parseParams,
  parseBody,
  isValidationError,
  formatValidationError,
} from "@/lib/api/validation"
import { idParamSchema, markPaidBodySchema } from "@/app/api/pausalni/_schemas"

export const POST = withApiLogging(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const user = await requireAuth()
      const company = await requireCompany(user.id!)

      // Parse and validate params
      const { id } = parseParams(await params, idParamSchema)

      setTenantContext({
        companyId: company.id,
        userId: user.id!,
      })

      // Parse and validate body
      const { paidDate, paidAmount, notes } = await parseBody(request, markPaidBodySchema)

      // Format date as YYYY-MM-DD string for drizzle date column
      const formattedPaidDate = paidDate
        ? new Date(paidDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0]

      const updated = await drizzleDb
        .update(paymentObligation)
        .set({
          status: OBLIGATION_STATUS.PAID,
          paidDate: formattedPaidDate,
          paidAmount: paidAmount?.toString(),
          matchType: "MANUAL",
          notes,
          updatedAt: new Date(),
        })
        .where(and(eq(paymentObligation.id, id), eq(paymentObligation.companyId, company.id)))
        .returning()

      if (updated.length === 0) {
        return NextResponse.json({ error: "Obligation not found" }, { status: 404 })
      }

      return NextResponse.json({ obligation: updated[0] })
    } catch (error) {
      if (isValidationError(error)) {
        return NextResponse.json(formatValidationError(error), { status: 400 })
      }
      console.error("Error marking obligation as paid:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }
)
