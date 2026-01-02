import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * GET /api/webauthn/passkeys
 *
 * Lists all passkeys registered for the authenticated user.
 * No request parameters required - uses session to identify the user.
 *
 * This endpoint is protected by session authentication.
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const passkeys = await db.webAuthnCredential.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({ passkeys })
  } catch (error) {
    console.error("Get passkeys error:", error)
    return NextResponse.json({ error: "Failed to get passkeys" }, { status: 500 })
  }
}
