// src/app/api/auth/send-code/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { z } from "zod"
import { generateOTP, hashOTP, OTP_EXPIRY_MINUTES } from "@/lib/auth/otp"
import { checkRateLimit } from "@/lib/security/rate-limit"
import { sendEmail } from "@/lib/email"
import { OTPCodeEmail } from "@/lib/email/templates/otp-code-email"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"

const schema = z.object({
  email: z.string().email(),
  type: z.enum(["EMAIL_VERIFY", "PASSWORD_RESET", "LOGIN_VERIFY"]),
  userId: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const { email, type, userId } = await parseBody(request, schema)

    // Rate limit check
    const rateLimitKey = `otp_send_${email.toLowerCase()}`
    const rateLimit = await checkRateLimit(rateLimitKey, "OTP_SEND")

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Previše zahtjeva. Pokušajte ponovno za sat vremena." },
        { status: 429 }
      )
    }

    // Delete any existing codes for this email and type
    await db.verificationCode.deleteMany({
      where: {
        email: email.toLowerCase(),
        type,
      },
    })

    // Generate and hash OTP
    const code = generateOTP()
    const codeHash = await hashOTP(code)

    // Calculate expiry
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES)

    // Create verification code record
    await db.verificationCode.create({
      data: {
        email: email.toLowerCase(),
        userId,
        codeHash,
        type,
        expiresAt,
      },
    })

    // Get user name for personalization
    let userName: string | undefined
    if (userId) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { name: true },
      })
      userName = user?.name || undefined
    }

    // Send email
    const emailType =
      type === "EMAIL_VERIFY" ? "verify" : type === "LOGIN_VERIFY" ? "login" : "reset"

    await sendEmail({
      to: email,
      subject: "Vaš FiskAI verifikacijski kod",
      react: OTPCodeEmail({ code, userName, type: emailType }),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Send code error:", error)
    return NextResponse.json({ error: "Greška pri slanju koda" }, { status: 500 })
  }
}
