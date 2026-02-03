import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@fiskai/db"

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email je obavezan" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        name: true,
        emailVerified: true,
      },
    })

    if (!user) {
      return NextResponse.json({
        exists: false,
      })
    }

    return NextResponse.json({
      exists: true,
      name: user.name,
      emailVerified: !!user.emailVerified,
      hasPasskey: false, // Passkeys not implemented yet
    })
  } catch (error) {
    console.error("Check email error:", error)
    return NextResponse.json({ error: "Greska pri provjeri emaila" }, { status: 500 })
  }
}
