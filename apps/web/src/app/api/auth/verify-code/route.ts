import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@fiskai/db"

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json()

    if (!email || !code) {
      return NextResponse.json({ error: "Email i kod su obavezni" }, { status: 400 })
    }

    // Find the verification code
    const verificationCode = await prisma.verificationCode.findFirst({
      where: {
        email: email.toLowerCase(),
        code,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    })

    if (!verificationCode) {
      return NextResponse.json({ error: "Neispravan ili istekao kod" }, { status: 400 })
    }

    // Mark code as used
    await prisma.verificationCode.update({
      where: { id: verificationCode.id },
      data: { usedAt: new Date() },
    })

    // If email verification, mark user as verified
    if (verificationCode.type === "EMAIL_VERIFICATION") {
      const user = await prisma.user.update({
        where: { email: email.toLowerCase() },
        data: { emailVerified: new Date() },
      })

      return NextResponse.json({
        message: "Email verificiran",
        userId: user.id,
      })
    }

    // For password reset, just return success (password will be reset in separate call)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    return NextResponse.json({
      message: "Kod verificiran",
      userId: user?.id,
      type: verificationCode.type,
    })
  } catch (error) {
    console.error("Verify code error:", error)
    return NextResponse.json({ error: "Greska pri verifikaciji koda" }, { status: 500 })
  }
}
