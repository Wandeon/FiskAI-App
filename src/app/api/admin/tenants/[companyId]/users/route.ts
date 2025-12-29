import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-utils"
import { db } from "@/lib/db"

type RouteContext = {
  params: Promise<{ companyId: string }>
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    await requireAdmin()
    const { companyId } = await context.params

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
    console.error("Failed to fetch tenant users:", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    await requireAdmin()
    const { companyId } = await context.params
    const body = await req.json()

    const { action, userId, role, email } = body

    if (action === "add") {
      // Add user to company
      if (!email) {
        return NextResponse.json({ error: "Email is required" }, { status: 400 })
      }

      // Find or create user
      let user = await db.user.findUnique({ where: { email } })

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }

      // Check if user is already in company
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

      // Add user to company
      await db.companyUser.create({
        data: {
          userId: user.id,
          companyId,
          role: role || "MEMBER",
        },
      })

      return NextResponse.json({ success: true })
    }

    if (action === "remove") {
      // Remove user from company
      if (!userId) {
        return NextResponse.json({ error: "User ID is required" }, { status: 400 })
      }

      // Check if user is owner
      const companyUser = await db.companyUser.findUnique({
        where: {
          userId_companyId: {
            userId,
            companyId,
          },
        },
      })

      if (!companyUser) {
        return NextResponse.json({ error: "User not found in company" }, { status: 404 })
      }

      if (companyUser.role === "OWNER") {
        return NextResponse.json(
          { error: "Cannot remove owner from company" },
          { status: 400 }
        )
      }

      await db.companyUser.delete({
        where: {
          userId_companyId: {
            userId,
            companyId,
          },
        },
      })

      return NextResponse.json({ success: true })
    }

    if (action === "change-role") {
      // Change user role
      if (!userId || !role) {
        return NextResponse.json({ error: "User ID and role are required" }, { status: 400 })
      }

      // Check if user exists in company
      const companyUser = await db.companyUser.findUnique({
        where: {
          userId_companyId: {
            userId,
            companyId,
          },
        },
      })

      if (!companyUser) {
        return NextResponse.json({ error: "User not found in company" }, { status: 404 })
      }

      // Prevent changing owner role
      if (companyUser.role === "OWNER" && role !== "OWNER") {
        return NextResponse.json(
          { error: "Cannot change owner role. Transfer ownership first." },
          { status: 400 }
        )
      }

      await db.companyUser.update({
        where: {
          userId_companyId: {
            userId,
            companyId,
          },
        },
        data: { role },
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Failed to manage tenant users:", error)
    return NextResponse.json({ error: "Failed to manage users" }, { status: 500 })
  }
}
