import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { drizzleDb } from "@/lib/db/drizzle"
import { euTransaction, euVendor } from "@/lib/db/schema/pausalni"
import { eq, and } from "drizzle-orm"
import { TRANSACTION_TYPES } from "@/lib/pausalni/constants"
import {
  parseParams,
  parseBody,
  isValidationError,
  formatValidationError,
} from "@/lib/api/validation"
import { idParamSchema, euTransactionConfirmBodySchema } from "@/app/api/pausalni/_schemas"

/**
 * POST /api/pausalni/eu-transactions/[id]/confirm
 * Confirm/reject a transaction as EU with goods/services classification
 * Supports VIES validation results and Intrastat tracking
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const company = await getCurrentCompany(user.id!)
    if (!company) {
      return NextResponse.json({ error: "No company selected" }, { status: 400 })
    }

    if (company.legalForm !== "OBRT_PAUSAL") {
      return NextResponse.json({ error: "Not a pausalni obrt" }, { status: 400 })
    }

    // Parse and validate params
    const { id } = parseParams(await params, idParamSchema)

    // Parse and validate body
    const { isEu, country, vendorName, transactionType, vatId, viesValidated, viesValid } =
      await parseBody(request, euTransactionConfirmBodySchema)

    const transaction = await drizzleDb
      .select()
      .from(euTransaction)
      .where(and(eq(euTransaction.id, id), eq(euTransaction.companyId, company.id)))
      .limit(1)

    if (transaction.length === 0) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {
      userConfirmed: true,
      counterpartyCountry: country,
    }

    if (isEu) {
      updateData.transactionType = transactionType || TRANSACTION_TYPES.SERVICES

      if (transactionType === TRANSACTION_TYPES.GOODS) {
        updateData.intrastatReportable = true
      }

      if (vatId) {
        updateData.counterpartyVatId = vatId
      }

      if (typeof viesValidated === "boolean") {
        updateData.viesValidated = viesValidated
        updateData.viesValidatedAt = viesValidated ? new Date() : null
        updateData.viesValid = viesValid ?? null
      }

      if (vendorName && country) {
        await drizzleDb
          .insert(euVendor)
          .values({
            namePattern: vendorName.toUpperCase().replace(/[^A-Z0-9\s]/g, ".*"),
            displayName: vendorName,
            countryCode: country,
            vendorType: "OTHER",
            isEu: true,
            confidenceScore: 80,
            isSystem: false,
          })
          .onConflictDoNothing()
      }
    }

    await drizzleDb.update(euTransaction).set(updateData).where(eq(euTransaction.id, id))

    const updated = await drizzleDb
      .select()
      .from(euTransaction)
      .where(eq(euTransaction.id, id))
      .limit(1)

    return NextResponse.json({
      message: isEu ? "Transaction confirmed as EU" : "Transaction rejected as non-EU",
      transaction: updated[0],
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Error confirming EU transaction:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
