import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-utils"
import { formatDigestEmail } from "@/lib/admin/weekly-digest"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {
    await requireAdmin()

    const { digestData } = await req.json()

    if (!digestData) {
      return NextResponse.json({ error: "Missing digest data" }, { status: 400 })
    }

    const emailHtml = formatDigestEmail(digestData)

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
    console.error("Failed to send digest:", error)
    return NextResponse.json({ error: "Failed to send digest" }, { status: 500 })
  }
}
