import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Token je obavezan" }, { status: 400 })
    }

    // Find the invitation
    const invitation = await db.clientInvitation.findUnique({
      where: { token },
      include: {
        staff: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    if (!invitation) {
      return NextResponse.json({ error: "Poziv nije pronađen" }, { status: 404 })
    }

    // Check if invitation is expired
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Poziv je istekao. Molimo zatražite novi poziv." },
        { status: 410 }
      )
    }

    // Check if invitation is not pending
    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: "Ovaj poziv je već prihvaćen ili otkazan" },
        { status: 409 }
      )
    }

    // Return invitation data
    return NextResponse.json({
      id: invitation.id,
      email: invitation.email,
      companyName: invitation.companyName,
      message: invitation.message,
      staff: invitation.staff,
      expiresAt: invitation.expiresAt,
    })
  } catch (error) {
    console.error("Error verifying invitation:", error)
    return NextResponse.json({ error: "Greška prilikom provjere poziva" }, { status: 500 })
  }
}
