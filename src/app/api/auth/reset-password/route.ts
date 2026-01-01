import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyOTP } from "@/lib/auth/otp"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"

const schema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  newPassword: z.string().min(8, "Lozinka mora imati najmanje 8 znakova"),
})

export async function POST(request: Request) {
  try {
    const { email, code, newPassword } = await parseBody(request, schema)

    // Find the verification code
    const verificationCode = await db.verificationCode.findFirst({
      where: {
        email: email.toLowerCase(),
        type: "PASSWORD_RESET",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    })

    if (!verificationCode) {
      return NextResponse.json({ error: "Kod je istekao ili nije validan" }, { status: 400 })
    }

    // Check attempts
    if (verificationCode.attempts >= 5) {
      await db.verificationCode.delete({ where: { id: verificationCode.id } })
      return NextResponse.json({ error: "Previše pokušaja. Zatražite novi kod." }, { status: 400 })
    }

    // Verify the code
    const isValid = await verifyOTP(code, verificationCode.codeHash)

    if (!isValid) {
      await db.verificationCode.update({
        where: { id: verificationCode.id },
        data: { attempts: { increment: 1 } },
      })
      return NextResponse.json({ error: "Neispravan kod" }, { status: 400 })
    }

    // Find the user
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!user) {
      return NextResponse.json({ error: "Korisnik nije pronađen" }, { status: 404 })
    }

    // Hash the new password and update
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: hashedPassword },
    })

    // Delete the used verification code
    await db.verificationCode.delete({ where: { id: verificationCode.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Reset password error:", error)
    return NextResponse.json({ error: "Greška na serveru" }, { status: 500 })
  }
}
