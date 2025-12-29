import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sendTestAlert } from "@/lib/system-status/alerting"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/system-status/alerts
 * Returns alert configuration status
 */
export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const config = {
    slack: {
      configured: !!process.env.SLACK_WEBHOOK_URL,
      channel: process.env.SLACK_CHANNEL || "#fiskai-alerts",
    },
    webhook: {
      configured: !!process.env.SYSTEM_STATUS_WEBHOOK_URL,
      url: process.env.SYSTEM_STATUS_WEBHOOK_URL
        ? `${new URL(process.env.SYSTEM_STATUS_WEBHOOK_URL).origin}/...`
        : null,
    },
    email: {
      configured: !!process.env.RESEND_API_KEY && !!process.env.ADMIN_ALERT_EMAIL,
      recipient: process.env.ADMIN_ALERT_EMAIL || null,
    },
  }

  const isConfigured = config.slack.configured || config.webhook.configured || config.email.configured

  return NextResponse.json({
    configured: isConfigured,
    channels: config,
    documentation: {
      slack: "Set SLACK_WEBHOOK_URL and optionally SLACK_CHANNEL",
      webhook: "Set SYSTEM_STATUS_WEBHOOK_URL for external monitoring services (Uptime Robot, Better Uptime, PagerDuty)",
      email: "Set RESEND_API_KEY and ADMIN_ALERT_EMAIL for critical email alerts",
    },
  })
}

/**
 * POST /api/admin/system-status/alerts
 * Send a test alert to verify configuration
 */
export async function POST() {
  const session = await auth()
  if (!session?.user || session.user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await sendTestAlert()

    return NextResponse.json({
      success: true,
      results: result,
      message: `Test alerts sent. Slack: ${result.slack ? "sent" : "skipped/failed"}, Webhook: ${result.webhook ? "sent" : "skipped/failed"}, Email: ${result.email ? "sent" : "skipped/failed"}`,
    })
  } catch (error) {
    console.error("[system-status-alerts] Test alert failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
