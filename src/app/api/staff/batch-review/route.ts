import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { getRequestMetadata } from "@/lib/staff-audit"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"
import { batchReviewSchema } from "../_schemas"

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.systemRole !== "STAFF" && user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden - Staff access required" }, { status: 403 })
    }

    const { companyId, reviews } = await parseBody(request, batchReviewSchema)

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
      return NextResponse.json({ error: "Access denied to this client" }, { status: 403 })
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

    // Create audit log for batch review
    const { ipAddress, userAgent } = getRequestMetadata(request.headers)
    await db.auditLog.create({
      data: {
        companyId,
        userId: user.id,
        action: "STAFF_BATCH_REVIEW",
        entity: "StaffReview",
        entityId: "batch",
        changes: {
          reviewedCount: results.length,
          entityTypes: reviews.map((r) => r.entityType),
        },
        ipAddress,
        userAgent,
      },
    })

    return NextResponse.json({
      success: true,
      reviewedCount: results.length,
      reviews: results,
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Batch review error:", error)
    return NextResponse.json(
      {
        error: "Batch review failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
