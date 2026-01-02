import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateWebAuthnAuthenticationOptions } from "@/lib/webauthn"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"
import { loginStartSchema } from "@/lib/api/webauthn-schemas"

/**
 * POST /api/webauthn/login/start
 *
 * Generates WebAuthn authentication options for login.
 * Requires the user's email to look up their registered passkeys.
 *
 * Request body:
 * - email: User's email address
 */
export async function POST(req: NextRequest) {
  try {
    // Validate request body with Zod schema
    const { email } = await parseBody(req, loginStartSchema)

    const user = await db.user.findUnique({
      where: { email },
      include: {
        webAuthnCredentials: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (user.webAuthnCredentials.length === 0) {
      return NextResponse.json({ error: "No passkeys registered" }, { status: 404 })
    }

    const options = await generateWebAuthnAuthenticationOptions(
      user.id,
      user.webAuthnCredentials.map((cred) => ({
        credentialId: cred.credentialId,
        publicKey: cred.publicKey,
        counter: cred.counter,
        transports: cred.transports ?? null,
      }))
    )

    return NextResponse.json({ ...options, userId: user.id })
  } catch (error) {
    // Handle validation errors
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }

    console.error("WebAuthn login start error:", error)
    return NextResponse.json(
      { error: "Failed to generate authentication options" },
      { status: 500 }
    )
  }
}
