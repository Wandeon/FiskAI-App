// src/lib/regulatory-truth/watchdog/slack.ts

import type { AuditReport } from "./types"

export interface ContentAlert {
  conceptId: string
  affectedGuides: string[]
  changesDetected: number
  severity: "critical" | "major" | "info"
  evidenceIds: string[]
  summary: string
  deepLinks: {
    evidence: string[]
    guides: string[]
  }
}

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL
const SLACK_CHANNEL = process.env.SLACK_CHANNEL || "#fiskai-alerts"

interface SlackBlock {
  type: string
  text?: { type: string; text: string; emoji?: boolean }
  elements?: Array<{ type: string; text: string }>
  fields?: Array<{ type: string; text: string }>
}

export interface SlackMessage {
  channel?: string
  blocks: SlackBlock[]
}

/**
 * Send a message to Slack
 */
export async function sendSlackMessage(message: SlackMessage): Promise<boolean> {
  if (!SLACK_WEBHOOK_URL) {
    console.log("[slack] No webhook URL configured, skipping notification")
    return false
  }

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: SLACK_CHANNEL,
        ...message,
      }),
    })

    if (!response.ok) {
      console.error("[slack] Failed to send message:", response.statusText)
      return false
    }

    return true
  } catch (error) {
    console.error("[slack] Error sending message:", error)
    return false
  }
}

/**
 * Send a critical alert to Slack
 */
export async function sendCriticalAlert(
  type: string,
  message: string,
  details?: Record<string, unknown>
): Promise<boolean> {
  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "🚨 Critical Alert", emoji: true },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Type:*\n${type}` },
        { type: "mrkdwn", text: `*Time:*\n${new Date().toISOString()}` },
      ],
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*Message:*\n${message}` },
    },
  ]

  if (details) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Details:*\n\`\`\`${JSON.stringify(details, null, 2)}\`\`\``,
      },
    })
  }

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: "<https://fiskai.hr/admin/watchdog|View Dashboard>" }],
  })

  return sendSlackMessage({ blocks })
}

/**
 * Send audit result to Slack
 */
export async function sendAuditResult(report: AuditReport): Promise<boolean> {
  const emoji = report.result === "PASS" ? "✅" : report.result === "PARTIAL" ? "⚠️" : "🚨"
  const color =
    report.result === "PASS" ? "good" : report.result === "PARTIAL" ? "warning" : "danger"

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${emoji} Audit ${report.result}`,
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Run Date:*\n${report.runDate.toISOString().split("T")[0]}` },
        { type: "mrkdwn", text: `*Score:*\n${report.overallScore.toFixed(1)}%` },
        { type: "mrkdwn", text: `*Rules Checked:*\n${report.rulesAudited}` },
        { type: "mrkdwn", text: `*Passed:*\n${report.rulesPassed}/${report.rulesAudited}` },
      ],
    },
  ]

  if (report.result !== "PASS" && report.findings.length > 0) {
    const failedRules = report.findings
      .filter((f) => !f.passed)
      .map(
        (f) =>
          `• ${f.conceptSlug}: ${f.checks
            .filter((c) => !c.passed)
            .map((c) => c.name)
            .join(", ")}`
      )
      .slice(0, 5)
      .join("\n")

    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Issues:*\n${failedRules}` },
    })
  }

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: "<https://fiskai.hr/admin/watchdog/audits|View Details>" }],
  })

  return sendSlackMessage({ blocks })
}

/**
 * Send a content alert to Slack for Sentinel-detected changes
 */
export async function sendContentAlert(alert: ContentAlert): Promise<boolean> {
  const emoji = alert.severity === "critical" ? "🚨" : alert.severity === "major" ? "⚠️" : "ℹ️"
  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${emoji} Sentinel Alert: ${alert.conceptId}`,
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Severity:*\n${alert.severity}` },
        { type: "mrkdwn", text: `*Changes:*\n${alert.changesDetected}` },
      ],
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*Summary:*\n${alert.summary}` },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Affected Guides:*\n${alert.affectedGuides.map((g) => `• <${origin}/vodic/${g}|${g}>`).join("\n")}`,
      },
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: `<${origin}/admin/regulatory|Open Dashboard>` }],
    },
  ]

  return sendSlackMessage({ blocks })
}
