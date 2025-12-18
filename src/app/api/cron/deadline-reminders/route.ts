// src/app/api/cron/deadline-reminders/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUpcomingDeadlines } from "@/lib/deadlines/queries"
import { Resend } from "resend"

// Vercel cron or external cron calls this endpoint
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Initialize Resend inside handler to avoid build-time errors
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 })
  }
  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    // Get all companies with paušalni obrt
    const companies = await db.company.findMany({
      where: {
        legalForm: "OBRT_PAUSAL",
      },
      include: {
        users: {
          include: {
            user: true,
          },
        },
      },
    })

    const results: { companyId: string; emailsSent: number }[] = []

    for (const company of companies) {
      // Get upcoming deadlines for paušalni
      const deadlines = await getUpcomingDeadlines(7, "pausalni", 5)

      // Filter to deadlines that need reminders (7 days, 3 days, 1 day before)
      const reminderDays = [7, 3, 1]
      const deadlinesToRemind = deadlines.filter((d) => {
        const daysLeft = Math.ceil(
          (new Date(d.deadlineDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
        return reminderDays.includes(daysLeft)
      })

      if (deadlinesToRemind.length === 0) {
        continue
      }

      // Get owner email
      const owner = company.users.find((u) => u.role === "OWNER")
      if (!owner?.user.email) continue

      // Send reminder email
      try {
        await resend.emails.send({
          from: "FiskAI <noreply@fiskai.hr>",
          to: owner.user.email,
          subject: `[FiskAI] Podsjetnik: ${deadlinesToRemind.length} rok(ova) uskoro`,
          html: generateReminderEmailHtml(company.name, deadlinesToRemind),
        })

        results.push({ companyId: company.id, emailsSent: 1 })
      } catch (emailError) {
        console.error(`Failed to send email to ${owner.user.email}:`, emailError)
      }
    }

    return NextResponse.json({
      success: true,
      companiesProcessed: companies.length,
      results,
    })
  } catch (error) {
    console.error("Deadline reminder cron error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

function generateReminderEmailHtml(
  companyName: string,
  deadlines: { title: string; deadlineDate: string; description?: string | null }[]
): string {
  const deadlineRows = deadlines
    .map((d) => {
      const daysLeft = Math.ceil(
        (new Date(d.deadlineDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
      const urgency = daysLeft <= 1 ? "🔴" : daysLeft <= 3 ? "🟡" : "🟢"

      return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          ${urgency} <strong>${d.title}</strong>
          ${d.description ? `<br><small style="color: #6b7280;">${d.description}</small>` : ""}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
          ${new Date(d.deadlineDate).toLocaleDateString("hr-HR")}<br>
          <small style="color: ${daysLeft <= 1 ? "#dc2626" : "#6b7280"};">
            ${daysLeft === 0 ? "Danas!" : daysLeft === 1 ? "Sutra!" : `za ${daysLeft} dana`}
          </small>
        </td>
      </tr>
    `
    })
    .join("")

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0891b2;">FiskAI - Podsjetnik na rokove</h2>
        <p>Poštovani,</p>
        <p>Ovo je podsjetnik za tvrtku <strong>${companyName}</strong> o nadolazećim rokovima:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 12px; text-align: left;">Rok</th>
              <th style="padding: 12px; text-align: right;">Datum</th>
            </tr>
          </thead>
          <tbody>
            ${deadlineRows}
          </tbody>
        </table>

        <p>
          <a href="https://erp.metrica.hr/dashboard"
             style="display: inline-block; padding: 12px 24px; background: #0891b2; color: white; text-decoration: none; border-radius: 6px;">
            Otvori FiskAI
          </a>
        </p>

        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
          Ovu poruku šalje FiskAI automatski. Možete promijeniti postavke obavijesti u aplikaciji.
        </p>
      </div>
    </body>
    </html>
  `
}
