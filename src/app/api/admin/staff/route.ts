import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"
import RoleChangeNotification from "@/emails/role-change-notification"

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { email, confirmationToken, reason } = body

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    if (!confirmationToken || typeof confirmationToken !== "string") {
      return NextResponse.json(
        { error: "Confirmation token is required for role changes" },
        { status: 400 }
      )
    }

    const expectedToken = `PROMOTE_${email.toLowerCase()}_${user.id}`
    if (confirmationToken !== expectedToken) {
      return NextResponse.json({ error: "Invalid confirmation token" }, { status: 400 })
    }

    const existingUser = await db.user.findUnique({ where: { email: email.toLowerCase() } })

    if (existingUser) {
      if (existingUser.id === user.id) {
        return NextResponse.json({ error: "You cannot modify your own role" }, { status: 403 })
      }

      if (existingUser.systemRole === "STAFF") {
        return NextResponse.json({ error: "User is already a staff member" }, { status: 400 })
      }
      if (existingUser.systemRole === "ADMIN") {
        return NextResponse.json({ error: "Cannot demote admin to staff" }, { status: 400 })
      }

      const oldRole = existingUser.systemRole

      const updatedUser = await db.user.update({
        where: { id: existingUser.id },
        data: { systemRole: "STAFF" },
        select: { id: true, email: true, name: true, systemRole: true },
      })

      try {
        console.log("[AUDIT] Role Change:", {
          action: "UPDATE",
          entity: "User",
          entityId: existingUser.id,
          userId: user.id,
          changes: { before: { systemRole: oldRole }, after: { systemRole: "STAFF" } },
          reason: reason || "No reason provided",
          timestamp: new Date().toISOString(),
        })
      } catch (auditError) {
        console.error("[AUDIT] Failed to log role change:", auditError)
      }

      try {
        await sendEmail({
          to: existingUser.email,
          subject: "FiskAI - Promjena sistemske uloge",
          react: RoleChangeNotification({
            userName: existingUser.name || existingUser.email,
            userEmail: existingUser.email,
            oldRole,
            newRole: "STAFF",
            changedBy: user.email,
            timestamp: new Date(),
            reason: reason || undefined,
          }),
        })
      } catch (emailError) {
        console.error("Failed to send role change notification email:", emailError)
      }

      return NextResponse.json({
        success: true,
        user: updatedUser,
        message: "User promoted to staff. Notification email sent.",
      })
    } else {
      return NextResponse.json(
        { error: "User not found. Please ensure the user has registered first." },
        { status: 404 }
      )
    }
  } catch (error) {
    console.error("Error adding staff member:", error)
    return NextResponse.json({ error: "Failed to add staff member" }, { status: 500 })
  }
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }

  try {
    const staff = await db.user.findMany({
      where: { systemRole: "STAFF" },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        _count: { select: { staffAssignments: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ staff })
  } catch (error) {
    console.error("Error fetching staff:", error)
    return NextResponse.json({ error: "Failed to fetch staff" }, { status: 500 })
  }
}
