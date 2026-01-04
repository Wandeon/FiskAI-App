// src/app/api/admin/regulatory-truth/coverage/route.ts
import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-utils"
import { db, dbReg } from "@/lib/db"
import { getCoverageSummary } from "@/lib/regulatory-truth/quality"
import { isValidationError, formatValidationError } from "@/lib/api/validation"

/**
 * GET /api/admin/regulatory-truth/coverage
 *
 * Returns coverage dashboard data including summary, issues, and pending reviews
 */
export async function GET() {
  try {
    // Check authentication and admin role
    const user = await getCurrentUser()
    if (!user || user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get overall summary
    const summary = await getCoverageSummary()

    // Get recent reports with issues (evidenceId is soft ref, no include)
    const reportsWithIssues = await db.coverageReport.findMany({
      where: {
        OR: [{ isComplete: false }, { warnings: { isEmpty: false } }],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    })

    // Get pending reviews
    const pendingReviews = await db.coverageReport.findMany({
      where: {
        isComplete: true,
        reviewerApproved: false,
        reviewedAt: null,
      },
      take: 10,
    })

    // Collect all evidenceIds and fetch from regulatory schema
    const allEvidenceIds = [
      ...reportsWithIssues.map((r) => r.evidenceId),
      ...pendingReviews.map((r) => r.evidenceId),
    ]
    const evidenceRecords = await dbReg.evidence.findMany({
      where: { id: { in: allEvidenceIds } },
      select: { id: true, url: true, fetchedAt: true },
    })
    const evidenceMap = new Map(evidenceRecords.map((e) => [e.id, e]))

    return NextResponse.json({
      summary,
      reportsWithIssues: reportsWithIssues.map((r) => ({
        id: r.id,
        evidenceId: r.evidenceId,
        evidenceUrl: evidenceMap.get(r.evidenceId)?.url ?? null,
        coverageScore: r.coverageScore,
        isComplete: r.isComplete,
        missingShapes: r.missingShapes,
        warnings: r.warnings,
        createdAt: r.createdAt,
      })),
      pendingReviews: pendingReviews.map((r) => ({
        id: r.id,
        evidenceId: r.evidenceId,
        evidenceUrl: evidenceMap.get(r.evidenceId)?.url ?? null,
        coverageScore: r.coverageScore,
        primaryContentType: r.primaryContentType,
      })),
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("[coverage] Error fetching coverage data:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
