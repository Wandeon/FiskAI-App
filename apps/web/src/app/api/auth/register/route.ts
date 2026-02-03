import { NextRequest, NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { prisma } from "@fiskai/db"

export async function POST(request: NextRequest) {
  try {
    const { email, name, password, businessType: _businessType } = await request.json()
    void _businessType // Will be used in company setup

    // Validation
    if (!email || !name || !password) {
      return NextResponse.json({ error: "Sva polja su obavezna" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Lozinka mora imati najmanje 8 znakova" }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      return NextResponse.json({ error: "Korisnik s ovim emailom vec postoji" }, { status: 400 })
    }

    // Hash password
    const passwordHash = await hash(password, 12)

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        passwordHash,
        // Note: businessType stored in company setup later
      },
    })

    return NextResponse.json({
      userId: user.id,
      message: "Korisnik kreiran. Provjerite email za verifikacijski kod.",
    })
  } catch (error) {
    console.error("Register error:", error)
    return NextResponse.json({ error: "Greska pri registraciji" }, { status: 500 })
  }
}
