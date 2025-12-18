import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { drizzleDb } from "@/lib/db/drizzle"
import { euTransaction } from "@/lib/db/schema/pausalni"
import { eq, and } from "drizzle-orm"
import { confirmEuTransaction } from "@/lib/pausalni/eu-detection"

/**
 * POST /api/pausalni/eu-transactions/[id]/confirm
 * Confirm/reject a transaction as EU (learns vendor)
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const company = await getCurrentCompany(user.id!)
    if (!company) {
      return NextResponse.json({ error: "No company selected" }, { status: 400 })
    }

    // Check if company is paušalni obrt
    if (company.legalForm !== "OBRT_PAUSAL") {
      return NextResponse.json({ error: "Not a paušalni obrt" }, { status: 400 })
    }

    const body = await request.json()
    const { isEu, country, vendorName } = body

    // Validate required fields
    if (typeof isEu !== "boolean") {
      return NextResponse.json({ error: "isEu is required and must be boolean" }, { status: 400 })
    }

    if (isEu && !country) {
      return NextResponse.json(
        { error: "country is required when confirming as EU transaction" },
        { status: 400 }
      )
    }

    // Check if transaction exists and belongs to the company
    const transaction = await drizzleDb
      .select()
      .from(euTransaction)
      .where(and(eq(euTransaction.id, params.id), eq(euTransaction.companyId, company.id)))
      .limit(1)

    if (transaction.length === 0) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    // Confirm the transaction (this will also learn the vendor if provided)
    await confirmEuTransaction(params.id, isEu, country, vendorName)

    // Fetch the updated transaction
    const updated = await drizzleDb
      .select()
      .from(euTransaction)
      .where(eq(euTransaction.id, params.id))
      .limit(1)

    return NextResponse.json({
      message: isEu ? "Transaction confirmed as EU" : "Transaction rejected as non-EU",
      transaction: updated[0],
    })
  } catch (error) {
    console.error("Error confirming EU transaction:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
