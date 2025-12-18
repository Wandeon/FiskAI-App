import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { drizzleDb } from "@/lib/db/drizzle"
import { paymentObligation, OBLIGATION_STATUS } from "@/lib/db/schema/pausalni"
import { eq, and } from "drizzle-orm"
import { withApiLogging } from "@/lib/api-logging"
import { setTenantContext } from "@/lib/prisma-extensions"

export const POST = withApiLogging(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const user = await requireAuth()
      const company = await requireCompany(user.id!)
      const { id } = await params

      setTenantContext({
        companyId: company.id,
        userId: user.id!,
      })

      const body = await request.json()
      const { paidDate, paidAmount, notes } = body

      const updated = await drizzleDb
        .update(paymentObligation)
        .set({
          status: OBLIGATION_STATUS.PAID,
          paidDate: paidDate ? new Date(paidDate) : new Date(),
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
      console.error("Error marking obligation as paid:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }
)
