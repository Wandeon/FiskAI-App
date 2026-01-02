import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { parseParams, isValidationError, formatValidationError } from "@/lib/api/validation"
import { passkeyIdParamsSchema } from "@/lib/api/webauthn-schemas"

/**
 * DELETE /api/webauthn/passkeys/[id]
 *
 * Deletes a passkey by its ID. The passkey must belong to the authenticated user.
 *
 * Route params:
 * - id: The passkey ID (CUID format)
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Await and validate route params with Zod schema
    const resolvedParams = await params
    const { id } = parseParams(resolvedParams, passkeyIdParamsSchema)

    const passkey = await db.webAuthnCredential.findUnique({
      where: { id },
    })

    if (!passkey || passkey.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await db.webAuthnCredential.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    // Handle validation errors
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }

    console.error("Delete passkey error:", error)
    return NextResponse.json({ error: "Failed to delete passkey" }, { status: 500 })
  }
}
