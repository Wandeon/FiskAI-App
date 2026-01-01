import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { logAudit, getIpFromHeaders, getUserAgentFromHeaders } from "@/lib/audit"
import { sendEmail } from "@/lib/email"
import { AdminUserManagementEmail } from "@/lib/email/templates/admin-user-management-email"
import { parseParams, isValidationError, formatValidationError } from "@/lib/api/validation"
import { tenantParamsSchema } from "@/app/api/admin/_schemas"

type RouteContext = {
  params: Promise<{ companyId: string }>
}

type AdminAction = "add" | "remove" | "change-role"

interface NotificationContext {
  action: AdminAction
  adminEmail: string
  companyName: string
  affectedUserEmail: string
  affectedUserName: string | null
  oldRole?: string
  newRole?: string
  ipAddress: string | null
  timestamp: string
}

async function sendAdminActionNotifications(
  context: NotificationContext,
  ownerEmail: string | null,
  ownerName: string | null
): Promise<void> {
  const timestamp = new Date().toLocaleString("hr-HR", {
    timeZone: "Europe/Zagreb",
    dateStyle: "full",
    timeStyle: "medium",
  })

  const emailPromises: Promise<unknown>[] = []

  if (ownerEmail && ownerEmail !== context.affectedUserEmail) {
    emailPromises.push(
      sendEmail({
        to: ownerEmail,
        subject: "[FiskAI Admin] Promjena korisnika u tvrtki " + context.companyName,
        react: AdminUserManagementEmail({
          recipientName: ownerName || "Vlasnik",
          recipientType: "owner",
          action: context.action,
          adminEmail: context.adminEmail,
          companyName: context.companyName,
          affectedUserEmail: context.affectedUserEmail,
          affectedUserName: context.affectedUserName,
          oldRole: context.oldRole,
          newRole: context.newRole,
          ipAddress: context.ipAddress,
          timestamp,
        }),
      }).catch((error) => {
        console.error("[AdminUserManagement] Failed to notify owner:", error)
      })
    )
  }

  emailPromises.push(
    sendEmail({
      to: context.affectedUserEmail,
      subject: "[FiskAI Admin] Promjena vaseg pristupa tvrtki " + context.companyName,
      react: AdminUserManagementEmail({
        recipientName: context.affectedUserName || "Korisnik",
        recipientType: "user",
        action: context.action,
        adminEmail: context.adminEmail,
        companyName: context.companyName,
        affectedUserEmail: context.affectedUserEmail,
        affectedUserName: context.affectedUserName,
        oldRole: context.oldRole,
        newRole: context.newRole,
        ipAddress: context.ipAddress,
        timestamp,
      }),
    }).catch((error) => {
      console.error("[AdminUserManagement] Failed to notify user:", error)
    })
  )

  await Promise.allSettled(emailPromises)
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    await requireAdmin()
    const { companyId } = parseParams(await context.params, tenantParamsSchema)

    const users = await db.companyUser.findMany({
      where: { companyId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    })

    return NextResponse.json({
      users: users.map((cu) => ({
        id: cu.id,
        userId: cu.user.id,
        email: cu.user.email,
        name: cu.user.name,
        image: cu.user.image,
        role: cu.role,
        isDefault: cu.isDefault,
        joinedAt: cu.createdAt,
        lastActive: cu.user.updatedAt,
      })),
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Failed to fetch tenant users:", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const admin = await requireAdmin()
    const { companyId } = parseParams(await context.params, tenantParamsSchema)
    const body = await req.json()

    const { action, userId, role, email, reason } = body

    const ipAddress = getIpFromHeaders(req.headers)
    const userAgent = getUserAgentFromHeaders(req.headers)

    const adminUser = await db.user.findUnique({
      where: { id: admin.id },
      select: { email: true, name: true },
    })

    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    })

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    const ownerCompanyUser = await db.companyUser.findFirst({
      where: { companyId, role: "OWNER" },
      include: {
        user: {
          select: { email: true, name: true },
        },
      },
    })

    if (action === "add") {
      if (!email) {
        return NextResponse.json({ error: "Email is required" }, { status: 400 })
      }

      const user = await db.user.findUnique({ where: { email } })

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }

      const existing = await db.companyUser.findUnique({
        where: {
          userId_companyId: {
            userId: user.id,
            companyId,
          },
        },
      })

      if (existing) {
        return NextResponse.json({ error: "User is already in company" }, { status: 400 })
      }

      const newRole = role || "MEMBER"

      const newCompanyUser = await db.companyUser.create({
        data: {
          userId: user.id,
          companyId,
          role: newRole,
        },
      })

      await logAudit({
        companyId,
        userId: admin.id,
        action: "CREATE",
        entity: "CompanyUser",
        entityId: newCompanyUser.id,
        changes: {
          after: {
            userId: user.id,
            userEmail: user.email,
            role: newRole,
            adminAction: "admin_add_user",
            reason: reason || "Admin portal action",
          },
        },
        ipAddress,
        userAgent,
      })

      await sendAdminActionNotifications(
        {
          action: "add",
          adminEmail: adminUser?.email || "admin@fiskai.hr",
          companyName: company.name || companyId,
          affectedUserEmail: user.email,
          affectedUserName: user.name,
          newRole,
          ipAddress,
          timestamp: new Date().toISOString(),
        },
        ownerCompanyUser?.user.email || null,
        ownerCompanyUser?.user.name || null
      )

      return NextResponse.json({ success: true })
    }

    if (action === "remove") {
      if (!userId) {
        return NextResponse.json({ error: "User ID is required" }, { status: 400 })
      }

      const companyUser = await db.companyUser.findUnique({
        where: {
          userId_companyId: {
            userId,
            companyId,
          },
        },
        include: {
          user: {
            select: { email: true, name: true },
          },
        },
      })

      if (!companyUser) {
        return NextResponse.json({ error: "User not found in company" }, { status: 404 })
      }

      if (companyUser.role === "OWNER") {
        return NextResponse.json({ error: "Cannot remove owner from company" }, { status: 400 })
      }

      await logAudit({
        companyId,
        userId: admin.id,
        action: "DELETE",
        entity: "CompanyUser",
        entityId: companyUser.id,
        changes: {
          before: {
            userId,
            userEmail: companyUser.user.email,
            role: companyUser.role,
            adminAction: "admin_remove_user",
            reason: reason || "Admin portal action",
          },
        },
        ipAddress,
        userAgent,
      })

      await db.companyUser.delete({
        where: {
          userId_companyId: {
            userId,
            companyId,
          },
        },
      })

      await sendAdminActionNotifications(
        {
          action: "remove",
          adminEmail: adminUser?.email || "admin@fiskai.hr",
          companyName: company.name || companyId,
          affectedUserEmail: companyUser.user.email,
          affectedUserName: companyUser.user.name,
          oldRole: companyUser.role,
          ipAddress,
          timestamp: new Date().toISOString(),
        },
        ownerCompanyUser?.user.email || null,
        ownerCompanyUser?.user.name || null
      )

      return NextResponse.json({ success: true })
    }

    if (action === "change-role") {
      if (!userId || !role) {
        return NextResponse.json({ error: "User ID and role are required" }, { status: 400 })
      }

      const companyUser = await db.companyUser.findUnique({
        where: {
          userId_companyId: {
            userId,
            companyId,
          },
        },
        include: {
          user: {
            select: { email: true, name: true },
          },
        },
      })

      if (!companyUser) {
        return NextResponse.json({ error: "User not found in company" }, { status: 404 })
      }

      if (companyUser.role === "OWNER" && role !== "OWNER") {
        return NextResponse.json(
          { error: "Cannot change owner role. Transfer ownership first." },
          { status: 400 }
        )
      }

      const oldRole = companyUser.role

      await db.companyUser.update({
        where: {
          userId_companyId: {
            userId,
            companyId,
          },
        },
        data: { role },
      })

      await logAudit({
        companyId,
        userId: admin.id,
        action: "UPDATE",
        entity: "CompanyUser",
        entityId: companyUser.id,
        changes: {
          before: { role: oldRole },
          after: {
            role,
            adminAction: "admin_change_role",
            reason: reason || "Admin portal action",
          },
        },
        ipAddress,
        userAgent,
      })

      await sendAdminActionNotifications(
        {
          action: "change-role",
          adminEmail: adminUser?.email || "admin@fiskai.hr",
          companyName: company.name || companyId,
          affectedUserEmail: companyUser.user.email,
          affectedUserName: companyUser.user.name,
          oldRole,
          newRole: role,
          ipAddress,
          timestamp: new Date().toISOString(),
        },
        ownerCompanyUser?.user.email || null,
        ownerCompanyUser?.user.name || null
      )

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Failed to manage tenant users:", error)
    return NextResponse.json({ error: "Failed to manage users" }, { status: 500 })
  }
}
