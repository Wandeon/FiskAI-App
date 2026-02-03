import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@fiskai/db"

// Generate a 6-digit code
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(request: NextRequest) {
  try {
    const { email, type } = await request.json()

    if (!email || !type) {
      return NextResponse.json({ error: "Email i tip su obavezni" }, { status: 400 })
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!user && type !== "EMAIL_VERIFICATION") {
      return NextResponse.json({ error: "Korisnik ne postoji" }, { status: 404 })
    }

    // Generate verification code
    const code = generateCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Delete any existing codes for this email and type
    await prisma.verificationCode.deleteMany({
      where: {
        email: email.toLowerCase(),
        type: type as "EMAIL_VERIFICATION" | "PASSWORD_RESET",
      },
    })

    // Create new verification code
    await prisma.verificationCode.create({
      data: {
        email: email.toLowerCase(),
        code,
        type: type as "EMAIL_VERIFICATION" | "PASSWORD_RESET",
        expiresAt,
      },
    })

    // TODO: Send email with Resend
    // For now, log the code in development
    if (process.env.NODE_ENV === "development") {
      console.log(`Verification code for ${email}: ${code}`)
    }

    // In production, you would send the email here:
    // await resend.emails.send({
    //   from: process.env.RESEND_FROM_EMAIL,
    //   to: email,
    //   subject: type === "PASSWORD_RESET" ? "Reset lozinke - FiskAI" : "Verifikacija emaila - FiskAI",
    //   html: `<p>Vas verifikacijski kod je: <strong>${code}</strong></p><p>Kod vrijedi 10 minuta.</p>`,
    // })

    return NextResponse.json({
      message: "Kod poslan",
      // Only include code in dev for testing
      ...(process.env.NODE_ENV === "development" && { code }),
    })
  } catch (error) {
    console.error("Send code error:", error)
    return NextResponse.json({ error: "Greska pri slanju koda" }, { status: 500 })
  }
}
