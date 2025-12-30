import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"
import RoleChangeNotification from "@/emails/role-change-notification"

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }

  const { userId } = await params

  try {
    const body = await request.json().catch(() => ({}))
    const { confirmationToken, reason } = body

    if (!confirmationToken || typeof confirmationToken !== "string") {
      return NextResponse.json({ error: "Confirmation token is required for role changes" }, { status: 400 })
    }

    const staffUser = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, systemRole: true } })

    if (!staffUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const expectedToken = `DEMOTE_${userId}_${user.id}`
    if (confirmationToken !== expectedToken) {
      return NextResponse.json({ error: "Invalid confirmation token" }, { status: 400 })
    }

    if (staffUser.id === user.id) {
      return NextResponse.json({ error: "You cannot modify your own role" }, { status: 403 })
    }

    if (staffUser.systemRole !== "STAFF") {
      return NextResponse.json({ error: "User is not a staff member" }, { status: 400 })
    }

    const oldRole = staffUser.systemRole

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: { systemRole: "USER" },
      select: { id: true, email: true, name: true, systemRole: true },
    })

    await db.staffAssignment.deleteMany({ where: { userId } })

    try {
      console.log("[AUDIT] Role Change:", {
        action: "UPDATE",
        entity: "User",
        entityId: userId,
        userId: user.id,
        changes: { before: { systemRole: oldRole }, after: { systemRole: "USER" } },
        reason: reason || "No reason provided",
        timestamp: new Date().toISOString(),
      })
    } catch (auditError) {
      console.error("[AUDIT] Failed to log role change:", auditError)
    }

    try {
      await sendEmail({
        to: staffUser.email,
        subject: "FiskAI - Promjena sistemske uloge",
        react: RoleChangeNotification({
          userName: staffUser.name || staffUser.email,
          userEmail: staffUser.email,
          oldRole,
          newRole: "USER",
          changedBy: user.email,
          timestamp: new Date(),
          reason: reason || undefined,
        }),
      })
    } catch (emailError) {
      console.error("Failed to send role change notification email:", emailError)
    }

    return NextResponse.json({ success: true, user: updatedUser, message: "Staff member removed and notification email sent." })
  } catch (error) {
    console.error("Error removing staff member:", error)
    return NextResponse.json({ error: "Failed to remove staff member" }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }

  const { userId } = await params

  try {
    const staffUser = await db.user.findUnique({
      where: { id: userId, systemRole: "STAFF" },
      select: { id: true, email: true, name: true, createdAt: true, staffAssignments: { include: { company: { select: { id: true, name: true, oib: true } } } } },
    })

    if (!staffUser) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 })
    }

    return NextResponse.json({ user: staffUser })
  } catch (error) {
    console.error("Error fetching staff member:", error)
    return NextResponse.json({ error: "Failed to fetch staff member" }, { status: 500 })
  }
}
