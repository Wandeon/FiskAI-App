import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyWebAuthnAuthentication } from "@/lib/webauthn"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"
import { loginFinishSchema } from "@/lib/api/webauthn-schemas"

/**
 * POST /api/webauthn/login/finish
 *
 * Completes WebAuthn authentication by verifying the assertion response
 * and generating a login token for the user.
 *
 * Request body:
 * - userId: User ID from the login/start response
 * - response: AuthenticationResponseJSON from navigator.credentials.get()
 */
export async function POST(req: NextRequest) {
  try {
    // Validate request body with Zod schema
    const { userId, response } = await parseBody(req, loginFinishSchema)

    // Normalize the credential ID (rawId is base64url from the browser)
    const rawIdBase64url =
      typeof response.rawId === "string"
        ? response.rawId
        : Buffer.from(response.rawId).toString("base64url")

    let rawIdBase64: string | null = null
    try {
      rawIdBase64 = Buffer.from(rawIdBase64url, "base64url").toString("base64")
    } catch (e) {
      void e
    }

    const credential = await db.webAuthnCredential.findFirst({
      where: {
        OR: [
          { credentialId: rawIdBase64url },
          ...(rawIdBase64 ? [{ credentialId: rawIdBase64 }] : []),
        ],
      },
      include: { user: true },
    })

    if (!credential || credential.userId !== userId) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 })
    }

    const verification = await verifyWebAuthnAuthentication(userId, response, {
      credentialId: credential.credentialId,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports ?? null,
    })

    if (!verification.verified) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 })
    }

    // Update credential counter and last used timestamp
    await db.webAuthnCredential.update({
      where: { id: credential.id },
      data: {
        counter: verification.newCounter,
        lastUsedAt: new Date(),
      },
    })

    const { generateLoginToken } = await import("@/lib/auth/login-token")
    const loginToken = await generateLoginToken({
      userId: credential.user.id,
      email: credential.user.email,
      type: "passkey",
    })

    return NextResponse.json({
      success: true,
      loginToken,
    })
  } catch (error) {
    // Handle validation errors
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }

    console.error("WebAuthn login finish error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to verify authentication",
      },
      { status: 500 }
    )
  }
}
