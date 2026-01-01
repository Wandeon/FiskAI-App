// src/app/api/cron/deadline-reminders/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { drizzleDb } from "@/lib/db/drizzle"
import { paymentObligation, OBLIGATION_STATUS } from "@/lib/db/schema/pausalni"
import { updateObligationStatuses } from "@/lib/pausalni/obligation-generator"
import { OBLIGATION_LABELS, CROATIAN_MONTHS_GENITIVE } from "@/lib/pausalni/constants"
import { eq, or, and, lte } from "drizzle-orm"
import { Resend } from "resend"
import { isValidationError, formatValidationError } from "@/lib/api/validation"

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

    const results: { companyId: string; emailsSent: number; obligationsSent: number }[] = []

    for (const company of companies) {
      // Update obligation statuses first
      await updateObligationStatuses(company.id)

      // Get obligations that need reminders:
      // - DUE_SOON (within 3 days)
      // - OVERDUE (past due date)
      // - PENDING obligations due within 7 days
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const sevenDaysFromNow = new Date(today)
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

      const obligations = await drizzleDb
        .select()
        .from(paymentObligation)
        .where(
          and(
            eq(paymentObligation.companyId, company.id),
            or(
              // Overdue obligations
              eq(paymentObligation.status, OBLIGATION_STATUS.OVERDUE),
              // Due soon obligations
              eq(paymentObligation.status, OBLIGATION_STATUS.DUE_SOON),
              // Pending obligations due within 7 days
              and(
                eq(paymentObligation.status, OBLIGATION_STATUS.PENDING),
                lte(paymentObligation.dueDate, sevenDaysFromNow.toISOString().split("T")[0])
              )
            )
          )
        )

      if (obligations.length === 0) {
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
          subject: `[FiskAI] Podsjetnik: ${obligations.length} obvez${obligations.length === 1 ? "a" : "e"} za uplatu`,
          html: generateReminderEmailHtml(company.name, company.id, obligations),
        })

        results.push({
          companyId: company.id,
          emailsSent: 1,
          obligationsSent: obligations.length,
        })
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
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

interface ObligationForEmail {
  id: string
  obligationType: string
  periodMonth: number
  periodYear: number
  amount: string
  dueDate: string
  status: string
}

function generateReminderEmailHtml(
  companyName: string,
  companyId: string,
  obligations: ObligationForEmail[]
): string {
  const obligationRows = obligations
    .map((ob) => {
      const daysLeft = Math.ceil(
        (new Date(ob.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )

      let urgency = "🟢"
      let statusText = "Uskoro"
      let statusColor = "#6b7280"

      if (ob.status === OBLIGATION_STATUS.OVERDUE) {
        urgency = "🔴"
        statusText = "KASNI!"
        statusColor = "#dc2626"
      } else if (ob.status === OBLIGATION_STATUS.DUE_SOON || daysLeft <= 3) {
        urgency = "🟡"
        statusText = daysLeft === 0 ? "Danas!" : daysLeft === 1 ? "Sutra!" : `Za ${daysLeft} dana`
        statusColor = "#f59e0b"
      } else {
        statusText = daysLeft === 0 ? "Danas!" : daysLeft === 1 ? "Sutra!" : `Za ${daysLeft} dana`
      }

      const obligationLabel = OBLIGATION_LABELS[ob.obligationType] || ob.obligationType
      const amount = parseFloat(ob.amount)
      const formattedAmount = amount > 0 ? `${amount.toFixed(2)} EUR` : "-"

      // Generate payment slip link
      let paymentSlipLink = ""
      if (
        amount > 0 &&
        (ob.obligationType.startsWith("DOPRINOSI_") ||
          ob.obligationType === "PDV" ||
          ob.obligationType === "HOK")
      ) {
        const slipType = ob.obligationType.replace("DOPRINOSI_", "")
        paymentSlipLink = `
          <br>
          <a href="https://app.fiskai.hr/pausalni/obligations?slip=${ob.id}"
             style="color: #0891b2; font-size: 12px; text-decoration: none;">
            📄 Generiraj uplatnicu
          </a>
        `
      }

      return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          ${urgency} <strong>${obligationLabel}</strong>
          <br><small style="color: #6b7280;">
            ${getPeriodLabel(ob.obligationType, ob.periodMonth, ob.periodYear)}
          </small>
          ${paymentSlipLink}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
          <strong>${formattedAmount}</strong>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
          ${new Date(ob.dueDate).toLocaleDateString("hr-HR")}<br>
          <small style="color: ${statusColor}; font-weight: bold;">
            ${statusText}
          </small>
        </td>
      </tr>
    `
    })
    .join("")

  const totalAmount = obligations.reduce((sum, ob) => sum + parseFloat(ob.amount), 0)

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background-color: #f9fafb;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h2 style="color: #0891b2; margin-top: 0;">FiskAI - Podsjetnik za plaćanje obveza</h2>
        <p>Poštovani,</p>
        <p>Ovo je podsjetnik za tvrtku <strong>${companyName}</strong> o nadolazećim obvezama za plaćanje:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 12px; text-align: left;">Obveza</th>
              <th style="padding: 12px; text-align: right;">Iznos</th>
              <th style="padding: 12px; text-align: right;">Rok</th>
            </tr>
          </thead>
          <tbody>
            ${obligationRows}
          </tbody>
          ${
            totalAmount > 0
              ? `
          <tfoot>
            <tr style="background: #f9fafb; font-weight: bold;">
              <td style="padding: 12px; border-top: 2px solid #0891b2;">UKUPNO</td>
              <td style="padding: 12px; text-align: right; border-top: 2px solid #0891b2;">${totalAmount.toFixed(2)} EUR</td>
              <td style="padding: 12px; border-top: 2px solid #0891b2;"></td>
            </tr>
          </tfoot>
          `
              : ""
          }
        </table>

        <div style="background: #ecfeff; border-left: 4px solid #0891b2; padding: 16px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #0e7490; font-size: 14px;">
            <strong>💡 Savjet:</strong> Možete generirati uplatnice za sve doprinose odjednom klikom na "Generiraj uplatnicu" u aplikaciji.
          </p>
        </div>

        <p style="text-align: center; margin: 30px 0;">
          <a href="https://app.fiskai.hr/pausalni/obligations"
             style="display: inline-block; padding: 14px 28px; background: #0891b2; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
            Pregled svih obveza
          </a>
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

        <p style="color: #6b7280; font-size: 12px; margin: 0;">
          Ovu poruku šalje FiskAI automatski kao podsjetnik na rokove za plaćanje. <br>
          Možete promijeniti postavke obavijesti u aplikaciji.
        </p>
      </div>
    </body>
    </html>
  `
}

function getPeriodLabel(obligationType: string, periodMonth: number, periodYear: number): string {
  // For quarterly obligations (POREZ_DOHODAK, HOK)
  if (obligationType === "POREZ_DOHODAK" || obligationType === "HOK") {
    return `Q${periodMonth} ${periodYear}`
  }

  // For annual obligations (PO_SD)
  if (obligationType === "PO_SD") {
    return `Godina ${periodYear}`
  }

  // For monthly obligations
  const monthName = CROATIAN_MONTHS_GENITIVE[periodMonth - 1] || `mjesec ${periodMonth}`
  return `za ${monthName} ${periodYear}`
}
