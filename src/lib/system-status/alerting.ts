/**
 * System Status Alerting
 *
 * Sends alerts for system status events to external monitoring channels:
 * - Slack webhook for instant team notifications
 * - Email alerts for critical events
 * - Webhook integration for external monitoring services (Uptime Robot, Better Uptime, etc.)
 */

import type { SystemStatusEventInput } from "./diff"

// Configuration from environment
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL
const SLACK_CHANNEL = process.env.SLACK_CHANNEL || "#fiskai-alerts"
const SYSTEM_STATUS_WEBHOOK_URL = process.env.SYSTEM_STATUS_WEBHOOK_URL
const ADMIN_ALERT_EMAIL = process.env.ADMIN_ALERT_EMAIL

// Alert deduplication - track recently sent alerts
const recentAlerts = new Map<string, number>()
const DEDUP_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

interface SlackBlock {
  type: string
  text?: { type: string; text: string; emoji?: boolean }
  elements?: Array<{ type: string; text: string }>
  fields?: Array<{ type: string; text: string }>
}

/**
 * Check if an alert was recently sent (deduplication)
 */
function wasRecentlySent(eventType: string, componentId?: string): boolean {
  const key = `${eventType}:${componentId || "global"}`
  const lastSent = recentAlerts.get(key)

  if (lastSent && Date.now() - lastSent < DEDUP_WINDOW_MS) {
    return true
  }

  // Clean up old entries
  const cutoff = Date.now() - DEDUP_WINDOW_MS
  for (const [k, v] of recentAlerts.entries()) {
    if (v < cutoff) {
      recentAlerts.delete(k)
    }
  }

  recentAlerts.set(key, Date.now())
  return false
}

/**
 * Map event severity to emoji
 */
function severityEmoji(severity: string): string {
  switch (severity) {
    case "CRITICAL":
      return "🚨"
    case "ERROR":
      return "❌"
    case "WARNING":
      return "⚠️"
    case "INFO":
      return "ℹ️"
    default:
      return "📋"
  }
}

/**
 * Send alert to Slack
 */
async function sendSlackAlert(event: SystemStatusEventInput): Promise<boolean> {
  if (!SLACK_WEBHOOK_URL) {
    console.log("[system-status-alerting] No Slack webhook configured, skipping")
    return false
  }

  const emoji = severityEmoji(event.severity)
  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${emoji} System Status: ${event.eventType.replace(/_/g, " ")}`,
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Severity:*\n${event.severity}` },
        { type: "mrkdwn", text: `*Time:*\n${new Date().toISOString()}` },
      ],
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*Message:*\n${event.message}` },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*Next Action:*\n${event.nextAction}` },
    },
  ]

  if (event.componentId || event.owner) {
    blocks.push({
      type: "section",
      fields: [
        ...(event.componentId ? [{ type: "mrkdwn", text: `*Component:*\n${event.componentId}` }] : []),
        ...(event.owner ? [{ type: "mrkdwn", text: `*Owner:*\n${event.owner}` }] : []),
      ],
    })
  }

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `<${origin}/admin/system-status|View System Status Dashboard>` }],
  })

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: SLACK_CHANNEL,
        blocks,
      }),
    })

    if (!response.ok) {
      console.error("[system-status-alerting] Slack notification failed:", response.statusText)
      return false
    }

    console.log(`[system-status-alerting] Slack alert sent: ${event.eventType}`)
    return true
  } catch (error) {
    console.error("[system-status-alerting] Slack notification error:", error)
    return false
  }
}

/**
 * Send alert to external webhook (for services like Uptime Robot, Better Uptime, PagerDuty)
 */
async function sendWebhookAlert(event: SystemStatusEventInput): Promise<boolean> {
  if (!SYSTEM_STATUS_WEBHOOK_URL) {
    console.log("[system-status-alerting] No external webhook configured, skipping")
    return false
  }

  const payload = {
    event_type: event.eventType,
    severity: event.severity,
    message: event.message,
    next_action: event.nextAction,
    component_id: event.componentId,
    owner: event.owner,
    timestamp: new Date().toISOString(),
    source: "fiskai-system-status",
    link: event.link,
  }

  try {
    const response = await fetch(SYSTEM_STATUS_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Source": "fiskai-system-status",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.error("[system-status-alerting] Webhook notification failed:", response.statusText)
      return false
    }

    console.log(`[system-status-alerting] Webhook alert sent: ${event.eventType}`)
    return true
  } catch (error) {
    console.error("[system-status-alerting] Webhook notification error:", error)
    return false
  }
}

/**
 * Send email alert for critical events
 */
async function sendEmailAlert(event: SystemStatusEventInput): Promise<boolean> {
  if (!ADMIN_ALERT_EMAIL) {
    console.log("[system-status-alerting] No admin email configured, skipping")
    return false
  }

  // Only send email for CRITICAL and ERROR severity
  if (event.severity !== "CRITICAL" && event.severity !== "ERROR") {
    return false
  }

  // Use Resend if available, fall back to logging
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@fiskai.hr"

  if (!RESEND_API_KEY) {
    console.log("[system-status-alerting] No Resend API key, skipping email")
    return false
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"
  const subject = `[FiskAI ${event.severity}] System Status: ${event.eventType.replace(/_/g, " ")}`

  const html = `
    <h2>System Status Alert</h2>
    <table style="border-collapse: collapse; margin: 16px 0;">
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Severity:</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd; color: ${event.severity === "CRITICAL" ? "red" : "orange"};">${event.severity}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Event:</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">${event.eventType}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Time:</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">${new Date().toISOString()}</td>
      </tr>
      ${event.componentId ? `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Component:</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">${event.componentId}</td>
      </tr>
      ` : ""}
      ${event.owner ? `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Owner:</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd;">${event.owner}</td>
      </tr>
      ` : ""}
    </table>

    <h3>Message</h3>
    <p>${event.message}</p>

    <h3>Next Action</h3>
    <p>${event.nextAction}</p>

    <hr style="margin: 24px 0;">
    <p><a href="${origin}/admin/system-status">View System Status Dashboard</a></p>
  `

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: ADMIN_ALERT_EMAIL,
        subject,
        html,
      }),
    })

    if (!response.ok) {
      console.error("[system-status-alerting] Email notification failed:", response.statusText)
      return false
    }

    console.log(`[system-status-alerting] Email alert sent to ${ADMIN_ALERT_EMAIL}`)
    return true
  } catch (error) {
    console.error("[system-status-alerting] Email notification error:", error)
    return false
  }
}

/**
 * Send alerts for system status events
 * Routes to appropriate channels based on severity
 */
export async function sendSystemStatusAlerts(events: SystemStatusEventInput[]): Promise<{
  sent: number
  skipped: number
  errors: number
}> {
  let sent = 0
  let skipped = 0
  let errors = 0

  for (const event of events) {
    // Deduplicate - don't spam for repeated events
    if (wasRecentlySent(event.eventType, event.componentId)) {
      console.log(
        `[system-status-alerting] Skipping duplicate alert: ${event.eventType} (sent recently)`
      )
      skipped++
      continue
    }

    const results = await Promise.allSettled([
      sendSlackAlert(event),
      sendWebhookAlert(event),
      sendEmailAlert(event),
    ])

    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value === true
    ).length

    if (successCount > 0) {
      sent++
    }

    const errorCount = results.filter((r) => r.status === "rejected").length
    errors += errorCount
  }

  return { sent, skipped, errors }
}

/**
 * Send a test alert to verify configuration
 */
export async function sendTestAlert(): Promise<{
  slack: boolean
  webhook: boolean
  email: boolean
}> {
  const testEvent: SystemStatusEventInput = {
    eventType: "NEW_OBSERVED",
    severity: "INFO",
    message: "Test alert from FiskAI System Status monitoring",
    nextAction: "No action required - this is a test notification",
  }

  const [slack, webhook, email] = await Promise.all([
    sendSlackAlert(testEvent),
    sendWebhookAlert(testEvent),
    sendEmailAlert({ ...testEvent, severity: "CRITICAL" }), // Email only sends for critical
  ])

  return { slack, webhook, email }
}
