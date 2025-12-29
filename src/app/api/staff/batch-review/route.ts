import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth-utils"
import { db } from "@/lib/db"

const batchReviewSchema = z.object({
  companyId: z.string(),
  reviews: z.array(
    z.object({
      entityType: z.enum(["INVOICE", "EXPENSE"]),
      entityId: z.string(),
      notes: z.string().optional(),
    })
  ),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.systemRole !== "STAFF" && user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden - Staff access required" }, { status: 403 })
    }

    const body = await request.json()
    const parsed = batchReviewSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.format() },
        { status: 400 }
      )
    }

    const { companyId, reviews } = parsed.data

    // Verify staff has access to this client
    const assignment = await db.staffAssignment.findUnique({
      where: {
        staffId_companyId: {
          staffId: user.id,
          companyId,
        },
      },
    })

    if (!assignment) {
      return NextResponse.json(
        { error: "Access denied to this client" },
        { status: 403 }
      )
    }

    // Create reviews in a transaction
    const results = await db.$transaction(
      reviews.map((review) =>
        db.staffReview.upsert({
          where: {
            companyId_entityType_entityId: {
              companyId,
              entityType: review.entityType,
              entityId: review.entityId,
            },
          },
          create: {
            companyId,
            reviewerId: user.id,
            entityType: review.entityType,
            entityId: review.entityId,
            notes: review.notes,
          },
          update: {
            reviewedAt: new Date(),
            notes: review.notes,
          },
        })
      )
    )

    return NextResponse.json({
      success: true,
      reviewedCount: results.length,
      reviews: results,
    })
  } catch (error) {
    console.error("Batch review error:", error)
    return NextResponse.json(
      { error: "Batch review failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
