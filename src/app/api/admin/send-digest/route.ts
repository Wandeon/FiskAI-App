import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth-utils"
import { formatDigestEmail } from "@/lib/admin/weekly-digest"
import { Resend } from "resend"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"
import type { WeeklyDigestData } from "@/lib/admin/weekly-digest-types"

const resend = new Resend(process.env.RESEND_API_KEY)

// Validate required fields for the digest data
const digestDataSchema = z.object({
  weekStart: z.coerce.date(),
  weekEnd: z.coerce.date(),
  newCustomers: z.object({
    count: z.number(),
    list: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        createdAt: z.coerce.date(),
        subscriptionStatus: z.string(),
      })
    ),
  }),
  mrr: z.object({
    currentMRR: z.number(),
    newMRR: z.number(),
    churnedMRR: z.number(),
    upgrades: z.number(),
    downgrades: z.number(),
  }),
  compliance: z.object({
    certificatesActive: z.number(),
    certificatesExpiring: z.number(),
    fiscalizedThisWeek: z.number(),
    successRate: z.number(),
  }),
  support: z.object({
    open: z.number(),
    closedThisWeek: z.number(),
    avgResponseTime: z.string(),
  }),
  actionItems: z.array(
    z.object({
      id: z.string(),
      level: z.string(),
      title: z.string(),
      companyName: z.string(),
      description: z.string(),
      autoAction: z.string().optional(),
    })
  ),
  totalTenants: z.number(),
  activeSubscriptions: z.number(),
  onboardingFunnel: z.object({
    started: z.number(),
    completed: z.number(),
    conversionRate: z.number(),
  }),
})

const bodySchema = z.object({
  digestData: digestDataSchema,
})

export async function POST(req: Request) {
  try {
    await requireAdmin()

    const { digestData } = await parseBody(req, bodySchema)

    const emailHtml = formatDigestEmail(digestData as WeeklyDigestData)

    // Send to admin recipients
    const adminEmail = process.env.ADMIN_EMAIL || "admin@fiskai.hr"

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "FiskAI <noreply@fiskai.hr>",
      to: adminEmail,
      subject: `FiskAI Weekly Digest - ${digestData.weekStart.toLocaleDateString("hr-HR")} - ${digestData.weekEnd.toLocaleDateString("hr-HR")}`,
      html: emailHtml,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Failed to send digest:", error)
    return NextResponse.json({ error: "Failed to send digest" }, { status: 500 })
  }
}
