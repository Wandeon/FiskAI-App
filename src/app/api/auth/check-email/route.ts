// src/app/api/auth/check-email/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { z } from "zod"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"

const schema = z.object({
  email: z.string().email(),
})

export async function POST(request: Request) {
  try {
    const { email } = await parseBody(request, schema)

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        name: true,
        emailVerified: true,
        webAuthnCredentials: { select: { id: true }, take: 1 },
      },
    })

    if (!user) {
      return NextResponse.json({ exists: false })
    }

    return NextResponse.json({
      exists: true,
      emailVerified: !!user.emailVerified,
      hasPasskey: user.webAuthnCredentials.length > 0,
      name: user.name,
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Check email error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
