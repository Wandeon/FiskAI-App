import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { auth } from "@/lib/auth"

export async function GET(request: NextRequest) {
  // Only allow with secret header
  const debugSecret = request.headers.get("x-debug-secret")
  if (debugSecret !== "fiskai-debug-2026") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const host = request.headers.get("host") || "unknown"
  const cookies = request.cookies.getAll()
  const cookieNames = cookies.map((c) => c.name)

  // Check for auth cookies
  const hasSessionCookie = cookieNames.some(
    (n) => n.includes("session-token") || n.includes("authjs")
  )

  // Try getToken
  let tokenResult = false
  let tokenError = null
  try {
    const token = await getToken({ req: request })
    tokenResult = !!token
  } catch (e) {
    tokenError = String(e)
  }

  // Try auth()
  let authResult = false
  let authError = null
  try {
    const session = await auth()
    authResult = !!session?.user
  } catch (e) {
    authError = String(e)
  }

  return NextResponse.json({
    host,
    cookieNames,
    hasSessionCookie,
    getTokenResult: tokenResult,
    getTokenError: tokenError,
    authResult,
    authError,
    timestamp: new Date().toISOString(),
  })
}
