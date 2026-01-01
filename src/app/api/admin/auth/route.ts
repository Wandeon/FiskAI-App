import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { z } from "zod"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"

// SECURITY: ADMIN_PASSWORD must be explicitly set in environment variables
// No fallback password is provided to prevent unauthorized access
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
const ADMIN_COOKIE = "fiskai_admin_auth"

const authBodySchema = z.object({
  password: z.string().min(1, "Password is required"),
})

export async function POST(request: NextRequest) {
  try {
    // Verify ADMIN_PASSWORD is configured
    if (!ADMIN_PASSWORD) {
      console.error("SECURITY: ADMIN_PASSWORD environment variable is not set")
      return NextResponse.json(
        { error: "Konfiguracija sustava nije ispravna. Kontaktirajte administratora." },
        { status: 500 }
      )
    }

    const { password } = await parseBody(request, authBodySchema)

    if (password === ADMIN_PASSWORD) {
      const cookieStore = await cookies()
      // Set a secure cookie valid for 24 hours
      cookieStore.set(ADMIN_COOKIE, "authenticated", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24, // 24 hours
        path: "/",
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Neispravna lozinka" }, { status: 401 })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    throw error
  }
}

export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete(ADMIN_COOKIE)
  return NextResponse.json({ success: true })
}
