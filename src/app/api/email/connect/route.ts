// src/app/api/email/connect/route.ts

import { NextResponse } from "next/server"
import { createHmac } from "crypto"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { setTenantContext } from "@/lib/prisma-extensions"
import { getEmailProvider, isEmailProviderConfigured } from "@/lib/email-sync/providers"

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)
    setTenantContext({ companyId: company.id, userId: user.id! })

    const { provider: providerName } = await request.json()

    if (!providerName || !["GMAIL", "MICROSOFT"].includes(providerName)) {
      return NextResponse.json(
        { error: "Invalid provider. Must be GMAIL or MICROSOFT" },
        { status: 400 }
      )
    }

    if (!isEmailProviderConfigured(providerName)) {
      return NextResponse.json(
        { error: `${providerName} provider not configured` },
        { status: 503 }
      )
    }

    const provider = getEmailProvider(providerName)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.fiskai.hr"
    const redirectUri = `${baseUrl}/api/email/callback`

    // Verify STATE_SECRET is configured
    const stateSecret = process.env.STATE_SECRET
    if (!stateSecret) {
      console.error("[email/connect] STATE_SECRET not configured")
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      )
    }

    // State contains provider, company info, and timestamp for callback
    const statePayload = {
      provider: providerName,
      companyId: company.id,
      timestamp: Date.now(),
    }

    // Sign the state with HMAC to prevent tampering
    const signature = createHmac("sha256", stateSecret)
      .update(JSON.stringify(statePayload))
      .digest("hex")

    const state = Buffer.from(
      JSON.stringify({ ...statePayload, signature })
    ).toString("base64url")

    const authUrl = provider.getAuthUrl(redirectUri, state)

    return NextResponse.json({ authUrl })
  } catch (error) {
    console.error("[email/connect] error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Connection failed" },
      { status: 500 }
    )
  }
}
