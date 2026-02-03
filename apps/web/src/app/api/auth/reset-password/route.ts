import { NextRequest, NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { prisma } from "@fiskai/db"

export async function POST(request: NextRequest) {
  try {
    const { email, code, newPassword } = await request.json()

    if (!email || !code || !newPassword) {
      return NextResponse.json({ error: "Sva polja su obavezna" }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Lozinka mora imati najmanje 8 znakova" }, { status: 400 })
    }

    // Verify the code
    const verificationCode = await prisma.verificationCode.findFirst({
      where: {
        email: email.toLowerCase(),
        code,
        type: "PASSWORD_RESET",
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

    // Hash new password and update user
    const passwordHash = await hash(newPassword, 12)

    await prisma.user.update({
      where: { email: email.toLowerCase() },
      data: { passwordHash },
    })

    return NextResponse.json({
      message: "Lozinka uspjesno promijenjena",
    })
  } catch (error) {
    console.error("Reset password error:", error)
    return NextResponse.json({ error: "Greska pri resetiranju lozinke" }, { status: 500 })
  }
}
