// src/lib/regulatory-truth/webhooks/email-parser.ts

/**
 * Email alert parser for regulatory notifications
 *
 * Handles email alerts from:
 * - Porezna uprava (Tax Authority)
 * - FINA
 * - Narodne novine (Official Gazette)
 * - HZZO (Health Insurance)
 * - Other government agencies
 */

export interface ParsedEmail {
  from: string
  subject: string
  body: string
  urls: string[]
  publishedAt?: Date
  category?: string
}

export interface EmailAlert {
  source: string // e.g., "porezna-uprava", "fina", "narodne-novine"
  title: string
  urls: string[]
  publishedAt?: Date
  priority: "HIGH" | "MEDIUM" | "LOW"
  category?: string
}

/**
 * Parse email notification and extract regulatory alerts
 */
export function parseEmailAlert(email: ParsedEmail): EmailAlert | null {
  const source = identifySource(email.from, email.subject)

  if (!source) {
    console.warn(`[email-parser] Unknown email source: ${email.from}`)
    return null
  }

  // Extract URLs from email body
  const urls = extractUrls(email.body)

  if (urls.length === 0) {
    console.warn(`[email-parser] No URLs found in email from ${email.from}`)
    return null
  }

  // Determine priority based on keywords
  const priority = determinePriority(email.subject, email.body)

  // Extract category (tax, social, fiscal, etc.)
  const category = extractCategory(email.subject, email.body)

  return {
    source,
    title: email.subject,
    urls,
    publishedAt: email.publishedAt,
    priority,
    category,
  }
}

/**
 * Identify regulatory source from email sender
 */
function identifySource(from: string, subject: string): string | null {
  const fromLower = from.toLowerCase()
  const subjectLower = subject.toLowerCase()

  // Porezna uprava (Tax Authority)
  if (
    fromLower.includes("porezna-uprava.hr") ||
    fromLower.includes("porezna") ||
    subjectLower.includes("porezna")
  ) {
    return "porezna-uprava"
  }

  // FINA
  if (fromLower.includes("fina.hr") || subjectLower.includes("fina")) {
    return "fina"
  }

  // Narodne novine (Official Gazette)
  if (
    fromLower.includes("narodne-novine.nn.hr") ||
    fromLower.includes("nn.hr") ||
    subjectLower.includes("narodne novine")
  ) {
    return "narodne-novine"
  }

  // HZZO (Health Insurance)
  if (fromLower.includes("hzzo.hr") || subjectLower.includes("hzzo")) {
    return "hzzo"
  }

  // HZMO (Pension Insurance)
  if (fromLower.includes("mirovinsko.hr") || subjectLower.includes("hzmo")) {
    return "hzmo"
  }

  // Croatian National Bank (HNB)
  if (fromLower.includes("hnb.hr") || subjectLower.includes("hnb")) {
    return "hnb"
  }

  // Ministry of Finance
  if (
    fromLower.includes("mfin.hr") ||
    fromLower.includes("ministarstvo financija") ||
    subjectLower.includes("ministarstvo financija")
  ) {
    return "ministarstvo-financija"
  }

  return null
}

/**
 * Extract URLs from email body
 */
function extractUrls(body: string): string[] {
  // Match both HTTP and HTTPS URLs
  const urlRegex = /(https?:\/\/[^\s<>"']+)/gi
  const matches = body.match(urlRegex)

  if (!matches) {
    return []
  }

  // Clean and deduplicate URLs
  const urls = matches
    .map((url) => {
      // Remove trailing punctuation
      return url.replace(/[.,;:!?)\]}>]+$/, "")
    })
    .filter((url) => {
      // Filter out tracking/unsubscribe links
      const urlLower = url.toLowerCase()
      return (
        !urlLower.includes("unsubscribe") &&
        !urlLower.includes("tracking") &&
        !urlLower.includes("pixel")
      )
    })

  // Deduplicate
  return Array.from(new Set(urls))
}

/**
 * Determine priority based on email content
 */
function determinePriority(subject: string, body: string): "HIGH" | "MEDIUM" | "LOW" {
  const text = `${subject} ${body}`.toLowerCase()

  // High priority keywords
  const highPriorityKeywords = [
    "hitno",
    "važno",
    "urgent",
    "rok",
    "deadline",
    "zakon",
    "law",
    "propis",
    "regulation",
    "obveza",
    "obligation",
    "novost",
    "new",
    "izmjena",
    "amendment",
    "porezna stopa",
    "tax rate",
    "prag",
    "threshold",
  ]

  // Medium priority keywords
  const mediumPriorityKeywords = [
    "uputa",
    "guidance",
    "mišljenje",
    "opinion",
    "tumačenje",
    "interpretation",
    "objava",
    "announcement",
    "obavijest",
    "notification",
  ]

  // Check high priority
  if (highPriorityKeywords.some((keyword) => text.includes(keyword))) {
    return "HIGH"
  }

  // Check medium priority
  if (mediumPriorityKeywords.some((keyword) => text.includes(keyword))) {
    return "MEDIUM"
  }

  return "LOW"
}

/**
 * Extract category from email content
 */
function extractCategory(subject: string, body: string): string | undefined {
  const text = `${subject} ${body}`.toLowerCase()

  // Tax categories
  if (text.includes("pdv") || text.includes("vat")) return "pdv"
  if (text.includes("pausalni") || text.includes("lump-sum")) return "pausalni"
  if (text.includes("porez na dohodak") || text.includes("income tax")) return "dohodak"
  if (text.includes("porez na dobit") || text.includes("profit tax")) return "dobit"

  // Social security
  if (text.includes("doprinosi") || text.includes("contributions")) return "doprinosi"
  if (text.includes("mirovina") || text.includes("pension")) return "mirovina"
  if (text.includes("zdravstveno") || text.includes("health insurance")) return "zdravstvo"

  // Fiscal
  if (text.includes("fiskalizacija") || text.includes("fiscalization")) return "fiskalizacija"
  if (text.includes("e-račun") || text.includes("e-invoice")) return "e-racun"

  // Employment
  if (text.includes("plaća") || text.includes("salary") || text.includes("payroll"))
    return "place"

  return undefined
}

/**
 * Convert email notification to webhook payload format
 */
export function emailToWebhookPayload(email: ParsedEmail): Record<string, unknown> {
  const alert = parseEmailAlert(email)

  if (!alert) {
    return {
      email_subject: email.subject,
      from_email: email.from,
      body: email.body,
      urls: extractUrls(email.body),
    }
  }

  return {
    email_subject: email.subject,
    from_email: email.from,
    source: alert.source,
    title: alert.title,
    urls: alert.urls,
    published_at: alert.publishedAt?.toISOString(),
    priority: alert.priority,
    category: alert.category,
  }
}

/**
 * Parse forwarded email from email service provider (e.g., SendGrid, Mailgun)
 */
export function parseForwardedEmail(payload: Record<string, unknown>): ParsedEmail | null {
  // SendGrid format
  if (payload.from && payload.subject && payload.text) {
    return {
      from: String(payload.from),
      subject: String(payload.subject),
      body: String(payload.html || payload.text),
      urls: extractUrls(String(payload.html || payload.text)),
      publishedAt: payload.timestamp ? new Date(String(payload.timestamp)) : undefined,
    }
  }

  // Mailgun format
  if (payload.sender && payload.Subject && payload["body-plain"]) {
    return {
      from: String(payload.sender),
      subject: String(payload.Subject),
      body: String(payload["body-html"] || payload["body-plain"]),
      urls: extractUrls(String(payload["body-html"] || payload["body-plain"])),
      publishedAt: payload.Date ? new Date(String(payload.Date)) : undefined,
    }
  }

  // Generic format
  if (payload.from_email && payload.email_subject && payload.body) {
    return {
      from: String(payload.from_email),
      subject: String(payload.email_subject),
      body: String(payload.body),
      urls: extractUrls(String(payload.body)),
      publishedAt: payload.published_at ? new Date(String(payload.published_at)) : undefined,
    }
  }

  return null
}
