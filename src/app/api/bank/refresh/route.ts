// src/app/api/bank/refresh/route.ts

import { NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import { getProvider, isProviderConfigured } from "@/lib/bank-sync/providers"

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)
    setTenantContext({ companyId: company.id, userId: user.id! })

    if (!isProviderConfigured()) {
      return NextResponse.json({ error: "Bank sync provider not configured" }, { status: 503 })
    }

    const { bankAccountId } = await request.json()

    if (!bankAccountId) {
      return NextResponse.json({ error: "bankAccountId is required" }, { status: 400 })
    }

    // Find the bank account and connection
    const bankAccount = await db.bankAccount.findFirst({
      where: { id: bankAccountId, companyId: company.id },
      include: {
        connection: true,
      },
    })

    if (!bankAccount) {
      return NextResponse.json({ error: "Bank account not found" }, { status: 404 })
    }

    if (!bankAccount.connection) {
      return NextResponse.json({ error: "No connection found for this account" }, { status: 400 })
    }

    // Get provider
    const provider = getProvider()

    // Check if current connection is still valid
    const isValid = await provider.isConnectionValid(bankAccount.connection.providerConnectionId)

    if (isValid) {
      // Connection is still valid, just update the UI state
      // This shouldn't happen if the UI is correctly showing status, but handle it gracefully
      return NextResponse.json(
        {
          error: "Connection is still valid, no refresh needed",
          stillValid: true,
        },
        { status: 400 }
      )
    }

    // Connection is expired/invalid, create a new connection
    const institutionId = await provider.getInstitutionId(bankAccount.bankName)

    if (!institutionId) {
      return NextResponse.json(
        { error: `Bank "${bankAccount.bankName}" is not supported for automatic sync` },
        { status: 400 }
      )
    }

    // Create new connection
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.fiskai.hr"
    const redirectUrl = `${baseUrl}/api/bank/callback`

    const result = await provider.createConnection(
      institutionId,
      redirectUrl,
      bankAccountId // Use bankAccountId as reference
    )

    // Derive provider enum from provider name
    const providerEnum = provider.name.toUpperCase() as "GOCARDLESS" | "PLAID" | "SALTEDGE"

    // Update existing connection record
    await db.bankConnection.update({
      where: { id: bankAccount.connection.id },
      data: {
        providerConnectionId: result.connectionId,
        institutionId,
        status: "MANUAL", // Will be updated on callback
        lastError: null,
      },
    })

    return NextResponse.json({ redirectUrl: result.redirectUrl })
  } catch (error) {
    console.error("[bank/refresh] error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Refresh failed" },
      { status: 500 }
    )
  }
}
