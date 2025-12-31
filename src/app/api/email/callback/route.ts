// src/app/api/email/callback/route.ts

import { redirect } from "next/navigation"
import { createHmac, timingSafeEqual } from "crypto"
import { db } from "@/lib/db"
import { getEmailProvider } from "@/lib/email-sync/providers"
import { encryptSecret } from "@/lib/secrets"

// State is valid for 10 minutes (600000 ms)
const STATE_EXPIRY_MS = 10 * 60 * 1000

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  if (error) {
    console.error("[email/callback] OAuth error:", error)
    redirect("/settings/email?error=oauth_denied")
  }

  if (!code || !state) {
    redirect("/settings/email?error=missing_params")
  }

  try {
    // Decode state
    const stateData = JSON.parse(Buffer.from(state, "base64url").toString())
    const { provider: providerName, companyId, timestamp, signature: providedSignature } = stateData

    if (!providerName || !companyId || !timestamp || !providedSignature) {
      console.error("[email/callback] Invalid state: missing required fields")
      redirect("/settings/email?error=invalid_state")
    }

    // Verify STATE_SECRET is configured
    const stateSecret = process.env.STATE_SECRET
    if (!stateSecret) {
      console.error("[email/callback] STATE_SECRET not configured")
      redirect("/settings/email?error=server_error")
    }

    // Verify timestamp hasn't expired
    const now = Date.now()
    const age = now - timestamp
    if (age > STATE_EXPIRY_MS) {
      console.error("[email/callback] State expired:", { age, limit: STATE_EXPIRY_MS })
      redirect("/settings/email?error=state_expired")
    }

    // Verify HMAC signature to prevent tampering
    const statePayload = { provider: providerName, companyId, timestamp }
    const expectedSignature = createHmac("sha256", stateSecret)
      .update(JSON.stringify(statePayload))
      .digest("hex")

    // Use timing-safe comparison to prevent timing attacks
    const providedBuffer = Buffer.from(providedSignature, "hex")
    const expectedBuffer = Buffer.from(expectedSignature, "hex")

    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      console.error("[email/callback] Invalid signature - state may have been tampered with")
      redirect("/settings/email?error=invalid_state")
    }

    const provider = getEmailProvider(providerName)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.fiskai.hr"
    const redirectUri = `${baseUrl}/api/email/callback`

    // Exchange code for tokens
    const tokens = await provider.exchangeCode(code, redirectUri)

    // Get user email address (for Gmail, from token info)
    let emailAddress = "unknown@email.com"

    if (providerName === "GMAIL") {
      // Fetch user profile to get email
      const { google } = await import("googleapis")
      const oauth2Client = new google.auth.OAuth2()
      oauth2Client.setCredentials({ access_token: tokens.accessToken })
      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client })
      const userInfo = await oauth2.userinfo.get()
      emailAddress = userInfo.data.email || emailAddress
    } else if (providerName === "MICROSOFT") {
      // Fetch user profile from Graph
      const { Client } = await import("@microsoft/microsoft-graph-client")
      const client = Client.init({
        authProvider: (done) => done(null, tokens.accessToken),
      })
      const user = await client.api("/me").select("mail,userPrincipalName").get()
      emailAddress = user.mail || user.userPrincipalName || emailAddress
    }

    // Create or update connection
    const providerEnum = providerName.toUpperCase() as "GMAIL" | "MICROSOFT"

    await db.emailConnection.upsert({
      where: {
        companyId_emailAddress: {
          companyId,
          emailAddress,
        },
      },
      create: {
        companyId,
        provider: providerEnum,
        emailAddress,
        status: "CONNECTED",
        accessTokenEnc: tokens.accessToken ? encryptSecret(tokens.accessToken) : null,
        refreshTokenEnc: encryptSecret(tokens.refreshToken),
        tokenExpiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
      },
      update: {
        status: "CONNECTED",
        accessTokenEnc: tokens.accessToken ? encryptSecret(tokens.accessToken) : null,
        refreshTokenEnc: encryptSecret(tokens.refreshToken),
        tokenExpiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        lastError: null,
      },
    })

    redirect("/settings/email?success=connected")
  } catch (error) {
    console.error("[email/callback] error:", error)
    redirect("/settings/email?error=callback_failed")
  }
}
