import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { verifyWebAuthnRegistration } from "@/lib/webauthn"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"
import { registerFinishSchema } from "@/lib/api/webauthn-schemas"

/**
 * POST /api/webauthn/register/finish
 *
 * Completes WebAuthn registration by verifying the credential response
 * and storing the new passkey in the database.
 *
 * Request body:
 * - response: RegistrationResponseJSON from navigator.credentials.create()
 * - name?: Optional friendly name for the passkey
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Validate request body with Zod schema
    const { response, name } = await parseBody(req, registerFinishSchema)

    const verification = await verifyWebAuthnRegistration(session.user.id, response)

    // Extract transports from response
    const transports = response.response.transports
      ? JSON.stringify(response.response.transports)
      : null

    // Save credential to database
    const credential = await db.webAuthnCredential.create({
      data: {
        userId: session.user.id,
        credentialId: verification.credentialId,
        publicKey: verification.publicKey,
        counter: verification.counter,
        transports,
        name: name || "Passkey",
      },
    })

    return NextResponse.json({
      success: true,
      credential: {
        id: credential.id,
        name: credential.name,
        createdAt: credential.createdAt,
      },
    })
  } catch (error) {
    // Handle validation errors
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }

    console.error("WebAuthn registration finish error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to verify registration",
      },
      { status: 500 }
    )
  }
}
