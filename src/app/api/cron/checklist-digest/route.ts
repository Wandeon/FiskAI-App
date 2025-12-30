// src/app/api/cron/checklist-digest/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { drizzleDb } from "@/lib/db/drizzle"
import { userGuidancePreferences } from "@/lib/db/schema/guidance"
import { getChecklist } from "@/lib/guidance/checklist"
import { sendEmail } from "@/lib/email"
import ChecklistDigestEmail from "@/lib/email/templates/checklist-digest-email"
import { eq } from "drizzle-orm"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes

/**
 * GET /api/cron/checklist-digest
 *
 * Sends checklist digest emails to users based on their preferences.
 * Run daily at 8:00 AM for daily digests, Mondays for weekly.
 *
 * Protected by CRON_SECRET header.
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer `) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const isMonday = new Date().getDay() === 1
  const digestTypes: ("daily" | "weekly")[] = isMonday ? ["daily", "weekly"] : ["daily"]

  let sent = 0
  let errors = 0

  try {
    // Get all users with their guidance preferences
    const users = await db.user.findMany({
      where: {
        emailVerified: { not: null },
      },
      include: {
        companies: {
          where: { role: { in: ["OWNER", "ADMIN"] } },
          include: { company: true },
        },
      },
    })

    for (const user of users) {
      // Get user's guidance preferences
      const [prefs] = await drizzleDb
        .select()
        .from(userGuidancePreferences)
        .where(eq(userGuidancePreferences.userId, user.id))
        .limit(1)

      // Skip if user disabled email digest
      const digestPref = (prefs?.emailDigest || "weekly") as "daily" | "weekly" | "none"
      if (digestPref === "none") continue
      if (!digestTypes.includes(digestPref as "daily" | "weekly")) continue

      // Process each company the user manages
      for (const companyUser of user.companies) {
        try {
          // Get business type for company
          const businessType = companyUser.company.legalForm === "OBRT_PAUSAL" ? "pausalni" : "all"

          // Fetch checklist items
          const { items } = await getChecklist({
            userId: user.id,
            companyId: companyUser.companyId,
            businessType,
            includeCompleted: false,
            includeDismissed: false,
            limit: 50,
          })

          // Filter pending urgent items
          const pendingItems = items
            .filter(
              (item) =>
                item.urgency === "critical" ||
                item.urgency === "soon" ||
                (digestPref === "weekly" && item.urgency === "upcoming")
            )
            .slice(0, 10)
            .map((item) => ({
              title: item.title,
              description: item.description,
              dueDate: item.dueDate
                ? new Date(item.dueDate).toLocaleDateString("hr-HR")
                : undefined,
              urgency: item.urgency,
              href: item.action?.href
                ? `${process.env.NEXTAUTH_URL}${item.action.href}`
                : undefined,
            }))

          // Count completed items in the period
          const periodStart =
            digestPref === "daily"
              ? new Date(Date.now() - 24 * 60 * 60 * 1000)
              : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

          // Note: We don't have completed items directly from getChecklist,
          // so we'll set completedCount to 0 for now. This would need enhancement
          // to track completed items separately if needed.
          const completedCount = 0

          // Skip if no items to report and no completions
          if (pendingItems.length === 0 && completedCount === 0) continue

          const baseUrl = process.env.NEXTAUTH_URL || "https://app.fiskai.hr"

          await sendEmail({
            to: user.email,
            subject: `[FiskAI] ${digestPref === "daily" ? "Dnevni" : "Tjedni"} pregled zadataka - ${companyUser.company.name}`,
            react: ChecklistDigestEmail({
              userName: user.name || undefined,
              companyName: companyUser.company.name,
              period: digestPref as "daily" | "weekly",
              items: pendingItems,
              completedCount,
              dashboardUrl: `${baseUrl}/dashboard`,
            }),
          })

          sent++
        } catch (err) {
          console.error(
            `Failed to send digest to ${user.email} for company ${companyUser.companyId}:`,
            err
          )
          errors++
        }
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      errors,
      digestTypes,
    })
  } catch (error) {
    console.error("Checklist digest cron error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
